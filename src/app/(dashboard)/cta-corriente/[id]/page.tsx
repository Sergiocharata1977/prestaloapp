'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Wallet } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable, type Column } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { apiFetch } from '@/lib/apiFetch';
import { useAuth } from '@/hooks/useAuth';
import { CAPABILITIES } from '@/lib/capabilities';
import type { FinCtaCteMovimiento, FinCtaCteOperacion } from '@/types/fin-ctacte';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ars(value: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(value);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function estadoTone(estado: FinCtaCteOperacion['estado']) {
  switch (estado) {
    case 'cancelada':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'al_dia':
      return 'bg-sky-100 text-sky-800 border-sky-200';
    case 'incumplida':
    case 'judicial':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'sin_pago':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'refinanciada':
      return 'bg-violet-100 text-violet-800 border-violet-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function estadoLabel(estado: FinCtaCteOperacion['estado']) {
  switch (estado) {
    case 'al_dia':       return 'Al dia';
    case 'sin_pago':     return 'Sin pago';
    case 'incumplida':   return 'Incumplida';
    case 'cancelada':    return 'Cancelada';
    case 'judicial':     return 'Judicial';
    case 'refinanciada': return 'Refinanciada';
    default:             return 'Activa';
  }
}

const TIPO_LABELS: Record<string, string> = {
  venta_inicial:  'Apertura',
  pago_cliente:   'Entrega de dinero',
  gasto_fijo:     'Gasto fijo',
  mora:           'Mora',
  ajuste_manual:  'Ajuste',
  refinanciacion: 'Refinanciacion',
  cancelacion:    'Cancelacion',
};

function movimientoLabel(tipo: FinCtaCteMovimiento['tipo']) {
  return TIPO_LABELS[tipo] ?? tipo.replace(/_/g, ' ');
}

function entregaMinimaText(op: FinCtaCteOperacion): string {
  const r = op.reglas;
  if (r.entrega_minima_tipo === 'monto_fijo') {
    return ars(r.entrega_minima_valor);
  }
  if (r.entrega_minima_tipo === 'pct_compra') {
    return `${r.entrega_minima_valor}% del valor de compra`;
  }
  return `${r.entrega_minima_valor}% del saldo`;
}

function moraText(op: FinCtaCteOperacion): string {
  const r = op.reglas;
  if (r.mora_tipo === 'pct_saldo') {
    return `${r.mora_valor}% del saldo`;
  }
  return ars(r.mora_valor);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PagoForm {
  importe: string;
  fecha: string;
  descripcion: string;
}

const PAGO_INITIAL: PagoForm = {
  importe: '',
  fecha: todayIso(),
  descripcion: 'Entrega de dinero',
};

export default function CtaCorrienteDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const { capabilities, loading: authLoading } = useAuth();

  const [operacion, setOperacion] = useState<FinCtaCteOperacion | null>(null);
  const [movimientos, setMovimientos] = useState<FinCtaCteMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagoOpen, setPagoOpen] = useState(false);
  const [pagoForm, setPagoForm] = useState<PagoForm>(PAGO_INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Capability guard — wait until auth is resolved
  useEffect(() => {
    if (authLoading) return;
    if (!capabilities.includes(CAPABILITIES.CTA_CTE_COMERCIAL)) {
      router.replace('/dashboard');
    }
  }, [authLoading, capabilities, router]);

  async function loadData() {
    if (!id) return;
    setLoading(true);
    setFetchError(null);

    try {
      const [opRes, movsRes] = await Promise.all([
        apiFetch(`/api/fin/ctacte/${id}`),
        apiFetch(`/api/fin/ctacte/${id}/movimientos`),
      ]);

      const opJson = (await opRes.json().catch(() => null)) as
        | { operacion?: FinCtaCteOperacion; error?: string }
        | null;
      const movsJson = (await movsRes.json().catch(() => null)) as
        | { movimientos?: FinCtaCteMovimiento[]; error?: string }
        | null;

      if (!opRes.ok) {
        throw new Error(opJson?.error ?? 'No se pudo cargar la operacion');
      }
      if (!movsRes.ok) {
        throw new Error(movsJson?.error ?? 'No se pudo cargar el historial');
      }

      setOperacion(opJson?.operacion ?? null);
      setMovimientos(movsJson?.movimientos ?? []);
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : 'Error al cargar los datos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleSubmitPago(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      const response = await apiFetch(`/api/fin/ctacte/${id}/pagos`, {
        method: 'POST',
        body: JSON.stringify({
          importe: Number(pagoForm.importe),
          fecha: pagoForm.fecha,
          descripcion: pagoForm.descripcion,
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(json?.error ?? 'No se pudo registrar la entrega');
      }

      setPagoOpen(false);
      setPagoForm(PAGO_INITIAL);
      await loadData();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Error al registrar la entrega');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Columns ────────────────────────────────────────────────────────────────

  const columns: Column<FinCtaCteMovimiento>[] = [
    { key: 'fecha', header: 'Fecha', width: '110px' },
    {
      key: 'tipo',
      header: 'Tipo',
      render: (row) => (
        <Badge variant="outline" className="capitalize whitespace-nowrap">
          {movimientoLabel(row.tipo)}
        </Badge>
      ),
    },
    {
      key: 'descripcion',
      header: 'Descripcion',
      render: (row) => (
        <div>
          <p className="font-medium text-slate-900">{row.descripcion}</p>
          {row.periodo ? (
            <p className="text-xs text-slate-500">Periodo {row.periodo}</p>
          ) : null}
        </div>
      ),
    },
    {
      key: 'importe',
      header: 'Importe',
      render: (row) => (
        <span
          className={
            row.impacto_saldo < 0
              ? 'text-emerald-700 font-mono'
              : row.impacto_saldo > 0
                ? 'text-red-600 font-mono'
                : 'font-mono text-slate-700'
          }
        >
          {ars(row.importe)}
        </span>
      ),
      className: 'text-right',
    },
    {
      key: 'saldo_nuevo',
      header: 'Saldo nuevo',
      render: (row) => ars(row.saldo_nuevo),
      className: 'text-right font-mono font-semibold text-slate-900',
    },
  ];

  // ─── Render states ──────────────────────────────────────────────────────────

  if (authLoading || loading) {
    return <div className="h-60 animate-pulse rounded-2xl bg-slate-200" />;
  }

  if (fetchError) {
    return (
      <div className="py-16 text-center">
        <p className="text-red-600 text-sm">{fetchError}</p>
        <Button variant="outline" className="mt-4" onClick={() => void loadData()}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!operacion) {
    return (
      <div className="py-16 text-center text-slate-500">Operacion no encontrada.</div>
    );
  }

  const canRegister =
    operacion.estado !== 'cancelada' && operacion.estado !== 'judicial';

  return (
    <div className="space-y-6">
      {/* Back nav */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/cta-corriente')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-slate-500">Volver a la lista</span>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <Badge className={estadoTone(operacion.estado)}>
              {estadoLabel(operacion.estado)}
            </Badge>
            <h1 className="text-2xl font-semibold text-slate-900">
              {operacion.cliente_nombre}
            </h1>
          </div>
          <p className="text-sm text-slate-500">
            Comprobante {operacion.comprobante} &middot; Fecha venta:{' '}
            {operacion.fecha_venta}
          </p>
          <p className="text-sm text-slate-600 font-medium">
            {operacion.detalle_mercaderia}
          </p>
        </div>

        {canRegister && (
          <Button
            onClick={() => {
              setPagoForm(PAGO_INITIAL);
              setSubmitError(null);
              setPagoOpen(true);
            }}
            className="shrink-0 gap-2"
          >
            <Plus className="h-4 w-4" />
            Registrar entrega
          </Button>
        )}
      </div>

      {/* Metrics */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-400">Monto original</p>
            <p className="text-xl font-semibold text-slate-900">
              {ars(operacion.monto_original)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-slate-400">Saldo actual</p>
            <p className="text-xl font-semibold text-slate-900">
              {ars(operacion.saldo_actual)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-slate-400" />
              <p className="text-xs text-slate-400">Ultimo pago</p>
            </div>
            <p className="text-xl font-semibold text-slate-900">
              {operacion.ultimo_pago_fecha ?? 'Sin pagos'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Conditions */}
      <Card>
        <CardHeader>
          <CardTitle>Condiciones de la operacion</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Entrega minima', entregaMinimaText(operacion)],
              ['Dia de control', `Dia ${operacion.reglas.dia_control}`],
              ['Mora', moraText(operacion)],
              ['Dias de gracia', `${operacion.reglas.gracia_dias} dias`],
              ['Gasto fijo mensual', ars(operacion.reglas.gasto_fijo_mensual)],
              [
                'Mora sin pago',
                operacion.reglas.aplica_mora_sin_pago ? 'Si' : 'No',
              ],
              [
                'Permite refinanciacion',
                operacion.reglas.permite_refinanciacion ? 'Si' : 'No',
              ],
            ].map(([label, value]) => (
              <div key={label}>
                <dt className="text-slate-400">{label}</dt>
                <dd className="font-medium text-slate-900">{value}</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>

      {/* Movements table */}
      <Card>
        <CardHeader>
          <CardTitle>Historial de movimientos</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            data={movimientos}
            emptyMessage="Sin movimientos registrados."
          />
        </CardContent>
      </Card>

      {/* Pago dialog */}
      <Dialog open={pagoOpen} onOpenChange={setPagoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar entrega</DialogTitle>
          </DialogHeader>

          <form id="pago-form" className="space-y-4" onSubmit={handleSubmitPago}>
            <div className="space-y-2">
              <Label htmlFor="importe">Importe</Label>
              <Input
                id="importe"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={pagoForm.importe}
                onChange={(e) =>
                  setPagoForm((prev) => ({ ...prev, importe: e.target.value }))
                }
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                required
                value={pagoForm.fecha}
                onChange={(e) =>
                  setPagoForm((prev) => ({ ...prev, fecha: e.target.value }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripcion</Label>
              <Input
                id="descripcion"
                required
                value={pagoForm.descripcion}
                onChange={(e) =>
                  setPagoForm((prev) => ({ ...prev, descripcion: e.target.value }))
                }
                placeholder="Descripcion del pago"
              />
            </div>

            {submitError ? (
              <p className="text-sm text-red-600">{submitError}</p>
            ) : null}
          </form>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPagoOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" form="pago-form" disabled={submitting}>
              {submitting ? 'Registrando...' : 'Confirmar entrega'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
