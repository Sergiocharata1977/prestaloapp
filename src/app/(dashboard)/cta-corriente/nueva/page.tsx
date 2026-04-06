'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { ArrowLeft, Plus, X } from 'lucide-react';
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
import type { FinStockProducto } from '@/types/fin-stock';

function today() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 2,
  }).format(value);
}

function parsePositiveInteger(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.floor(parsed));
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

type FormValues = {
  cliente_id: string;
  cliente_nombre: string;
  politica_id: string;
  sucursal_id: string;
  fecha_venta: string;
  comprobante: string;
  detalle_mercaderia: string;
  monto_original: string;
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

type MercaderiaItem = {
  productoId: string;
  nombre: string;
  cantidad: number;
  precioUnitario: number;
};

type ClientesResponse = {
  clientes?: FinCliente[];
  error?: string;
};

type PoliticasResponse = {
  politicas?: FinCtaCtePolitica[];
  error?: string;
};

type ProductosResponse = {
  productos?: FinStockProducto[];
  error?: string;
};

type CrearOperacionResponse = {
  id?: string;
  error?: string;
};

const defaultValues: FormValues = {
  cliente_id: '',
  cliente_nombre: '',
  politica_id: '',
  sucursal_id: '',
  fecha_venta: today(),
  comprobante: '',
  detalle_mercaderia: '',
  monto_original: '0',
  ...reglasToForm(DEFAULT_REGLAS),
};

export default function NuevaCtaCorrientePage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<FinCliente[]>([]);
  const [politicas, setPoliticas] = useState<FinCtaCtePolitica[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mercaderiaItems, setMercaderiaItems] = useState<MercaderiaItem[]>([]);
  const [showMercaderiaPanel, setShowMercaderiaPanel] = useState(false);
  const [stockProductos, setStockProductos] = useState<FinStockProducto[]>([]);
  const [loadingStockProductos, setLoadingStockProductos] = useState(false);
  const [stockProductosLoaded, setStockProductosLoaded] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [selectedProductoId, setSelectedProductoId] = useState('');
  const [selectedCantidad, setSelectedCantidad] = useState('1');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues,
  });

  const politicaId = watch('politica_id');
  const selectedPolitica = useMemo(
    () => politicas.find((item) => item.id === politicaId),
    [politicaId, politicas]
  );
  const selectedProducto = useMemo(
    () => stockProductos.find((item) => item.id === selectedProductoId),
    [selectedProductoId, stockProductos]
  );
  const mercaderiaTotal = useMemo(
    () =>
      mercaderiaItems.reduce(
        (acc, item) => acc + item.cantidad * item.precioUnitario,
        0
      ),
    [mercaderiaItems]
  );

  useEffect(() => {
    let mounted = true;

    Promise.all([
      apiFetch('/api/fin/clientes'),
      apiFetch('/api/fin/ctacte-politicas?activa=true'),
    ])
      .then(async ([clientesResponse, politicasResponse]) => {
        const clientesJson = (await clientesResponse.json().catch(() => null)) as
          | ClientesResponse
          | null;
        const politicasJson = (await politicasResponse.json().catch(() => null)) as
          | PoliticasResponse
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

  async function loadStockProductos() {
    if (stockProductosLoaded || loadingStockProductos) {
      return;
    }

    setLoadingStockProductos(true);
    setStockError(null);

    try {
      const response = await apiFetch('/api/fin/stock/productos?soloConStock=true');
      const json = (await response.json().catch(() => null)) as ProductosResponse | null;

      if (!response.ok) {
        throw new Error(json?.error ?? 'No se pudo cargar la lista de productos');
      }

      setStockProductos(json?.productos ?? []);
      setStockProductosLoaded(true);
    } catch (fetchError) {
      setStockError(
        fetchError instanceof Error
          ? fetchError.message
          : 'No se pudo cargar la lista de productos'
      );
    } finally {
      setLoadingStockProductos(false);
    }
  }

  function handleOpenMercaderiaPanel() {
    setShowMercaderiaPanel(true);
    void loadStockProductos();
  }

  function handlePoliticaChange(value: string) {
    setValue('politica_id', value);

    const politica = politicas.find((item) => item.id === value);
    const reglas = politica ? reglasToForm(politica.reglas) : reglasToForm(DEFAULT_REGLAS);

    setValue('entrega_minima_tipo', reglas.entrega_minima_tipo);
    setValue('entrega_minima_valor', reglas.entrega_minima_valor);
    setValue('gasto_fijo_mensual', reglas.gasto_fijo_mensual);
    setValue('dia_control', reglas.dia_control);
    setValue('gracia_dias', reglas.gracia_dias);
    setValue('aplica_mora_sin_pago', reglas.aplica_mora_sin_pago);
    setValue('mora_tipo', reglas.mora_tipo);
    setValue('mora_valor', reglas.mora_valor);
    setValue('permite_refinanciacion', reglas.permite_refinanciacion);
  }

  function handleAddProducto() {
    if (!selectedProducto) {
      setStockError('Selecciona un producto para agregar');
      return;
    }

    const cantidad = parsePositiveInteger(selectedCantidad);
    const existingItem = mercaderiaItems.find(
      (item) => item.productoId === selectedProducto.id
    );

    setMercaderiaItems((current) => {
      if (existingItem) {
        return current.map((item) =>
          item.productoId === selectedProducto.id
            ? { ...item, cantidad: item.cantidad + cantidad }
            : item
        );
      }

      return [
        ...current,
        {
          productoId: selectedProducto.id,
          nombre: selectedProducto.nombre,
          cantidad,
          precioUnitario: selectedProducto.precio_venta_contado,
        },
      ];
    });

    setSelectedProductoId('');
    setSelectedCantidad('1');
    setStockError(null);
    setShowMercaderiaPanel(false);
  }

  function handleRemoveProducto(productoId: string) {
    setMercaderiaItems((current) =>
      current.filter((item) => item.productoId !== productoId)
    );
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    setError(null);

    try {
      const response = await apiFetch('/api/fin/ctacte', {
        method: 'POST',
        body: JSON.stringify({
          cliente_id: values.cliente_id,
          cliente_nombre: values.cliente_nombre,
          sucursal_id: values.sucursal_id || undefined,
          fecha_venta: values.fecha_venta,
          comprobante: values.comprobante,
          detalle_mercaderia: values.detalle_mercaderia,
          monto_original: Number(values.monto_original),
          reglas: {
            entrega_minima_tipo: values.entrega_minima_tipo,
            entrega_minima_valor: Number(values.entrega_minima_valor),
            gasto_fijo_mensual: Number(values.gasto_fijo_mensual),
            dia_control: Number(values.dia_control),
            gracia_dias: Number(values.gracia_dias),
            aplica_mora_sin_pago: values.aplica_mora_sin_pago,
            mora_tipo: values.mora_tipo,
            mora_valor: Number(values.mora_valor),
            permite_refinanciacion: values.permite_refinanciacion,
          },
          mercaderia_items: mercaderiaItems.map((item) => ({
            productoId: item.productoId,
            nombre: item.nombre,
            cantidad: item.cantidad,
            precioUnitario: item.precioUnitario,
          })),
        }),
      });

      const json = (await response.json().catch(() => null)) as
        | CrearOperacionResponse
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

      <form className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]" onSubmit={handleSubmit(onSubmit)}>
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
                  disabled={loadingData}
                  {...register('cliente_id', {
                    required: 'Seleccionar cliente es obligatorio',
                    onChange: (event) => {
                      const cliente = clientes.find((item) => item.id === event.target.value);
                      setValue('cliente_nombre', cliente?.nombre ?? '');
                    },
                  })}
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
                {errors.cliente_id ? (
                  <p className="text-xs text-red-600">{errors.cliente_id.message}</p>
                ) : null}
              </label>

              <input type="hidden" {...register('cliente_nombre', { required: true })} />

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Politica reutilizable
                <select
                  className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  disabled={loadingData}
                  {...register('politica_id', {
                    onChange: (event) => handlePoliticaChange(event.target.value),
                  })}
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
                <Input type="date" required {...register('fecha_venta', { required: true })} />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Monto original
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  {...register('monto_original', { required: true })}
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
                Comprobante
                <Input
                  placeholder="Factura A 0001-00001234"
                  required
                  {...register('comprobante', { required: true })}
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
                Detalle mercaderia
                <Textarea
                  placeholder="Detalle de articulos, condiciones o referencia comercial"
                  required
                  {...register('detalle_mercaderia', { required: true })}
                />
              </label>
            </div>

            <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Mercaderia incluida en la operacion
                  </p>
                  <p className="text-sm text-slate-500">
                    Opcional. Cada item agregado descuenta stock al guardar.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleOpenMercaderiaPanel}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar producto
                </Button>
              </div>

              {showMercaderiaPanel ? (
                <div className="grid gap-3 rounded-2xl border border-amber-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_120px_auto] md:items-end">
                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    Producto
                    <select
                      className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                      value={selectedProductoId}
                      onChange={(event) => setSelectedProductoId(event.target.value)}
                      disabled={loadingStockProductos}
                    >
                      <option value="">
                        {loadingStockProductos ? 'Cargando productos...' : 'Seleccionar producto'}
                      </option>
                      {stockProductos.map((producto) => (
                        <option key={producto.id} value={producto.id}>
                          {producto.codigo} - {producto.nombre} [stock: {producto.stock_actual}]
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm font-medium text-slate-700">
                    Cantidad
                    <Input
                      type="number"
                      min="1"
                      step="1"
                      value={selectedCantidad}
                      onChange={(event) => setSelectedCantidad(event.target.value)}
                    />
                  </label>

                  <div className="flex gap-2">
                    <Button type="button" onClick={handleAddProducto}>
                      Agregar
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        setShowMercaderiaPanel(false);
                        setStockError(null);
                      }}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : null}

              {selectedProducto ? (
                <p className="text-sm text-slate-600">
                  Precio unitario actual: {formatCurrency(selectedProducto.precio_venta_contado)}
                </p>
              ) : null}

              {stockError ? <p className="text-sm text-red-600">{stockError}</p> : null}

              {mercaderiaItems.length > 0 ? (
                <div className="space-y-3">
                  {mercaderiaItems.map((item) => {
                    const subtotal = item.cantidad * item.precioUnitario;

                    return (
                      <div
                        key={item.productoId}
                        className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-slate-900">{item.nombre}</p>
                          <p className="text-sm text-slate-500">
                            {item.cantidad} x {formatCurrency(item.precioUnitario)}
                          </p>
                          <p className="text-sm font-semibold text-slate-700">
                            Subtotal: {formatCurrency(subtotal)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveProducto(item.productoId)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}

                  <div className="flex justify-end border-t border-slate-200 pt-3">
                    <p className="text-sm font-semibold text-slate-900">
                      Total mercaderia: {formatCurrency(mercaderiaTotal)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No hay productos adjuntados a esta operacion.
                </p>
              )}
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
            {selectedPolitica ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                Politica aplicada: <span className="font-medium">{selectedPolitica.nombre}</span>
              </div>
            ) : null}

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Entrega minima
              <select
                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                {...register('entrega_minima_tipo')}
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
                {...register('entrega_minima_valor')}
              />
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Gasto fijo mensual
              <Input
                type="number"
                min="0"
                step="0.01"
                {...register('gasto_fijo_mensual')}
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Dia control
                <Input type="number" min="1" max="28" step="1" {...register('dia_control')} />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Dias de gracia
                <Input type="number" min="0" step="1" {...register('gracia_dias')} />
              </label>
            </div>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Tipo mora
              <select
                className="flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                {...register('mora_tipo')}
              >
                <option value="monto_fijo">Monto fijo</option>
                <option value="pct_saldo">% saldo</option>
              </select>
            </label>

            <label className="space-y-2 text-sm font-medium text-slate-700">
              Valor mora
              <Input type="number" min="0" step="0.01" {...register('mora_valor')} />
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
              <input type="checkbox" {...register('aplica_mora_sin_pago')} />
              Aplicar mora si no hubo pago
            </label>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm text-slate-700">
              <input type="checkbox" {...register('permite_refinanciacion')} />
              Permite refinanciacion
            </label>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
