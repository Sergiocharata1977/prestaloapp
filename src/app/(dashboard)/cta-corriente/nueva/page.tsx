'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/apiFetch';
import type { FinCliente } from '@/types/fin-cliente';
import type {
  FinCtaCteCargoT,
  FinCtaCteEntregaMinimaT,
  FinCtaCtePolitica,
  FinCtaCteReglas,
} from '@/types/fin-ctacte';

function today() {
  return new Date().toISOString().slice(0, 10);
}

const DEFAULT_REGLAS: FinCtaCteReglas = {
  entrega_minima_tipo: 'pct_compra',
  entrega_minima_valor: 20,
  gasto_fijo_mensual: 0,
  dia_control: 10,
  gracia_dias: 5,
  aplica_mora_sin_pago: true,
  mora_tipo: 'pct_saldo',
  mora_valor: 5,
  permite_refinanciacion: true,
};

function reglasToForm(reglas: FinCtaCteReglas) {
  return {
    entrega_minima_tipo: reglas.entrega_minima_tipo,
    entrega_minima_valor: String(reglas.entrega_minima_valor),
    gasto_fijo_mensual: String(reglas.gasto_fijo_mensual),
    dia_control: String(reglas.dia_control),
    gracia_dias: String(reglas.gracia_dias),
    aplica_mora_sin_pago: reglas.aplica_mora_sin_pago,
    mora_tipo: reglas.mora_tipo,
    mora_valor: String(reglas.mora_valor),
    permite_refinanciacion: reglas.permite_refinanciacion,
  };
}

export default function NuevaCtaCorrientePage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<FinCliente[]>([]);
  const [politicas, setPoliticas] = useState<FinCtaCtePolitica[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    cliente_id: '',
    cliente_nombre: '',
    politica_id: '',
    sucursal_id: '',
    fecha_venta: today(),
    comprobante: '',
    detalle_mercaderia: '',
    monto_original: '0',
    ...reglasToForm(DEFAULT_REGLAS),
  });

  useEffect(() => {
    let mounted = true;

    Promise.all([
      apiFetch('/api/fin/clientes'),
      apiFetch('/api/fin/ctacte-politicas?activa=true'),
    ])
      .then(async ([clientesResponse, politicasResponse]) => {
        const clientesJson = (await clientesResponse.json().catch(() => null)) as
          | { clientes?: FinCliente[]; error?: string }
          | null;
        const politicasJson = (await politicasResponse.json().catch(() => null)) as
          | { politicas?: FinCtaCtePolitica[]; error?: string }
          | null;

        if (!clientesResponse.ok) {
          throw new Error(clientesJson?.error ?? 'No se pudo cargar la lista de clientes');
        }

        if (!politicasResponse.ok) {
          throw new Error(
            politicasJson?.error ?? 'No se pudo cargar la lista de politicas'
          );
        }

        if (mounted) {
          setClientes(clientesJson?.clientes ?? []);
          setPoliticas(politicasJson?.politicas ?? []);
          setError(null);
        }
      })
      .catch((fetchError: unknown) => {
        if (mounted) {
          setError(
            fetchError instanceof Error
              ? fetchError.message
              : 'No se pudieron cargar los datos iniciales'
          );
        }
      })
      .finally(() => {
        if (mounted) {
          setLoadingData(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const response = await apiFetch('/api/fin/ctacte', {
        method: 'POST',
        body: JSON.stringify({
          cliente_id: form.cliente_id,
          cliente_nombre: form.cliente_nombre,
          sucursal_id: form.sucursal_id || undefined,
          fecha_venta: form.fecha_venta,
          comprobante: form.comprobante,
          detalle_mercaderia: form.detalle_mercaderia,
          monto_original: Number(form.monto_original),
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
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | { id?: string; error?: string }
        | null;

      if (!response.ok || !json?.id) {
        throw new Error(json?.error ?? 'No se pudo crear la operacion');
      }

      router.push(`/cta-corriente/${json.id}`);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'No se pudo crear la operacion'
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/cta-corriente')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Nueva cuenta corriente</h1>
          <p className="text-sm text-slate-500">
            Alta de venta financiada con saldo inicial igual al monto original.
          </p>
        </div>
      </div>

      <form className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]" onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Datos de la operacion</CardTitle>
            <CardDescription>Cliente, venta origen y monto financiado.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Cliente
                <select
                  className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  value={form.cliente_id}
                  onChange={(event) => {
                    const cliente = clientes.find((item) => item.id === event.target.value);
                    setForm((current) => ({
                      ...current,
                      cliente_id: event.target.value,
                      cliente_nombre: cliente?.nombre ?? '',
                    }));
                  }}
                  disabled={loadingData}
                  required
                >
                  <option value="">
                    {loadingData ? 'Cargando clientes...' : 'Seleccionar cliente'}
                  </option>
                  {clientes.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.nombre} | {cliente.cuit}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Politica reutilizable
                <select
                  className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  value={form.politica_id}
                  onChange={(event) => {
                    const politica = politicas.find((item) => item.id === event.target.value);
                    setForm((current) => ({
                      ...current,
                      politica_id: event.target.value,
                      ...(politica ? reglasToForm(politica.reglas) : reglasToForm(DEFAULT_REGLAS)),
                    }));
                  }}
                  disabled={loadingData}
                >
                  <option value="">Sin politica precargada</option>
                  {politicas.map((politica) => (
                    <option key={politica.id} value={politica.id}>
                      {politica.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Fecha de venta
                <Input
                  type="date"
                  value={form.fecha_venta}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, fecha_venta: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Monto original
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monto_original}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, monto_original: event.target.value }))
                  }
                  required
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
                Comprobante
                <Input
                  value={form.comprobante}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, comprobante: event.target.value }))
                  }
                  placeholder="Factura A 0001-00001234"
                  required
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
                Detalle mercaderia
                <Textarea
                  value={form.detalle_mercaderia}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      detalle_mercaderia: event.target.value,
                    }))
                  }
                  placeholder="Detalle de articulos, condiciones o referencia comercial"
                  required
                />
              </label>
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <div className="flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push('/cta-corriente')}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={saving || loadingData}>
                {saving ? 'Guardando...' : 'Crear operacion'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Reglas snapshot</CardTitle>
            <CardDescription>
              Se copian al momento de alta y pueden ajustarse antes de guardar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {form.politica_id ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Politica aplicada:{' '}
                <span className="font-medium">
                  {politicas.find((item) => item.id === form.politica_id)?.nombre ?? form.politica_id}
                </span>
              </div>
            ) : null}

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
              />
            </label>

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
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
