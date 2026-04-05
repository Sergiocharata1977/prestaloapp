# Plan Plugin Stock de Mercadería — Ejecución multi-agente

**Fecha:** 2026-04-05
**Feature:** Plugin activable de gestión de stock/mercadería conectado a Venta Financiada y Cta. Cte. Financiada
**Proyectos afectados:** `prestaloapp` (único repo)
**Rubro objetivo:** Electrodomésticos · Tecnología · Ropa y Calzado · Muebles y Hogar

---

## Contexto del dominio

La organización vende artículos físicos (electrodomésticos, ropa, calzado, tecnología) y los
financia a través de dos mecanismos ya existentes:

1. **Venta Financiada** (`/ventas-financiadas`) — crédito en cuotas fijas para compra de un bien.
2. **Cuenta Corriente Financiada** (`/cta-corriente`) — línea de crédito flexible con entregas parciales.

El plugin de stock agrega:
- Catálogo de **categorías** y **productos** (con precio de lista y stock mínimo).
- Registro de **movimientos de stock** (ingresos por compra a proveedor, egresos por venta).
- **Descuento automático** de stock cuando se crea una Venta Financiada o se agrega mercadería
  en una operación de Cta. Cte.
- Navegación protegida por capability `stock_mercaderia` — solo visible si el plugin está activo.

---

## Resumen de olas

| Ola | Agentes | Paralelos entre sí | Dependen de |
|-----|---------|---------------------|-------------|
| 1   | A, B    | Sí                  | Nada        |
| 2   | A       | Es el único         | Ola 1       |
| 3   | A, B, C | Sí                  | Ola 2       |
| 4   | A, B, C | Sí                  | Ola 3       |
| 5   | A, B    | Sí                  | Ola 4       |

---

## Ola 1 — Fundación: tipos, colecciones y capability

> Ejecutar **Agente A** y **Agente B** en PARALELO

---

### Agente A — Tipos TypeScript + Colecciones Firestore

**Puede ejecutarse en paralelo con:** Agente B
**Depende de:** nada — es la primera ola

#### Objetivo
Crear `src/types/fin-stock.ts` con todos los tipos del plugin y agregar las colecciones
de stock a `src/firebase/collections.ts`.

#### Archivos a crear
- `src/types/fin-stock.ts` — tipos completos del dominio de stock

#### Archivos a modificar
- `src/firebase/collections.ts` — agregar colecciones `fin_stock_categorias`, `fin_stock_productos`, `fin_stock_movimientos`

#### Prompt completo para el agente

```
Sos un agente de desarrollo trabajando en "prestaloapp", una fintech SaaS multi-tenant.
Stack: Next.js 16 + React 19 + TypeScript strict + Firebase 12 Firestore + Tailwind v4.

Tu tarea es EXCLUSIVAMENTE:
1. Crear el archivo `src/types/fin-stock.ts` con los tipos del plugin de stock.
2. Modificar `src/firebase/collections.ts` para agregar las colecciones de stock.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 1 — Crear src/types/fin-stock.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Crea el archivo con EXACTAMENTE este contenido:

```typescript
// src/types/fin-stock.ts

export type FinStockRubro =
  | 'electrodomesticos'
  | 'tecnologia'
  | 'ropa_calzado'
  | 'muebles_hogar'
  | 'otro';

export const FIN_STOCK_RUBRO_LABELS: Record<FinStockRubro, string> = {
  electrodomesticos: 'Electrodomésticos',
  tecnologia: 'Tecnología',
  ropa_calzado: 'Ropa y Calzado',
  muebles_hogar: 'Muebles y Hogar',
  otro: 'Otro',
};

export type FinStockUnidad = 'unidad' | 'par' | 'docena' | 'kg' | 'metro';

export const FIN_STOCK_UNIDAD_LABELS: Record<FinStockUnidad, string> = {
  unidad: 'Unidad',
  par: 'Par',
  docena: 'Docena',
  kg: 'Kilogramo',
  metro: 'Metro',
};

// ─── Categoría ───────────────────────────────────────────────────────────────

export interface FinStockCategoria {
  id: string;
  organization_id: string;
  nombre: string;
  descripcion?: string;
  rubro: FinStockRubro;
  activa: boolean;
  createdAt: string;
  createdBy: string;
}

export type FinStockCategoriaInput = Omit<FinStockCategoria, 'id' | 'organization_id' | 'createdAt' | 'createdBy'>;

// ─── Producto ────────────────────────────────────────────────────────────────

export interface FinStockProducto {
  id: string;
  organization_id: string;
  categoria_id: string;
  categoria_nombre: string;     // desnormalizado para queries rápidas
  codigo: string;               // SKU / código interno
  nombre: string;
  descripcion?: string;
  marca?: string;
  modelo?: string;
  unidad_medida: FinStockUnidad;
  precio_costo?: number;         // costo de adquisición (opcional)
  precio_venta_contado: number;  // precio de lista al contado
  activo: boolean;
  stock_actual: number;          // actualizado en cada movimiento (desnormalizado)
  stock_minimo: number;          // umbral para alerta de stock bajo
  requiere_serie: boolean;       // si cada unidad tiene número de serie
  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

export type FinStockProductoInput = Omit<
  FinStockProducto,
  'id' | 'organization_id' | 'stock_actual' | 'createdAt' | 'createdBy' | 'updatedAt'
>;

// ─── Movimiento de Stock ──────────────────────────────────────────────────────

export type FinMovimientoStockTipo =
  | 'ingreso_compra'              // entrada por compra a proveedor
  | 'ingreso_devolucion_cliente'  // devolución de un cliente
  | 'ingreso_ajuste'              // ajuste manual positivo
  | 'egreso_venta_financiada'     // salida por crédito de venta financiada
  | 'egreso_venta_ctacte'         // salida por operación de cuenta corriente
  | 'egreso_ajuste'               // ajuste manual negativo
  | 'egreso_devolucion_proveedor';// devolución a proveedor

export const FIN_MOVIMIENTO_TIPO_LABELS: Record<FinMovimientoStockTipo, string> = {
  ingreso_compra: 'Ingreso por compra',
  ingreso_devolucion_cliente: 'Devolución de cliente',
  ingreso_ajuste: 'Ajuste manual (+)',
  egreso_venta_financiada: 'Venta financiada',
  egreso_venta_ctacte: 'Venta Cta. Cte.',
  egreso_ajuste: 'Ajuste manual (−)',
  egreso_devolucion_proveedor: 'Devolución a proveedor',
};

export const FIN_MOVIMIENTO_INGRESO_TIPOS: FinMovimientoStockTipo[] = [
  'ingreso_compra',
  'ingreso_devolucion_cliente',
  'ingreso_ajuste',
];

export interface FinMovimientoStock {
  id: string;
  organization_id: string;
  producto_id: string;
  producto_nombre: string;     // desnormalizado
  tipo: FinMovimientoStockTipo;
  cantidad: number;            // siempre positivo; el tipo determina la dirección
  stock_anterior: number;      // snapshot antes del movimiento
  stock_nuevo: number;         // snapshot después del movimiento
  /** ID del crédito o operación cta-cte que originó el movimiento (si aplica) */
  referencia_id?: string;
  referencia_tipo?: 'credito' | 'ctacte';
  referencia_numero?: string;  // número de crédito u operación
  costo_unitario?: number;
  precio_unitario?: number;
  numero_serie?: string;       // si requiere_serie = true
  notas?: string;
  createdAt: string;
  createdBy: string;
}

export type FinMovimientoStockInput = Omit<
  FinMovimientoStock,
  'id' | 'organization_id' | 'stock_anterior' | 'stock_nuevo' | 'createdAt' | 'createdBy'
>;

// ─── Resumen para listado ─────────────────────────────────────────────────────

export interface FinStockResumen {
  producto_id: string;
  producto_nombre: string;
  categoria_nombre: string;
  rubro: FinStockRubro;
  stock_actual: number;
  stock_minimo: number;
  alerta_stock_bajo: boolean;
  precio_venta_contado: number;
  ultimo_movimiento?: string;
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PASO 2 — Modificar src/firebase/collections.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Lee el archivo actual. Al FINAL del objeto FIN_COLLECTIONS (antes del `} as const`)
agrega estas entradas de stock:

```typescript
  // ── Plugin Stock de Mercadería ──────────────────────────────────────────────
  stockCategorias: (orgId: string) =>
    `organizations/${orgId}/fin_stock_categorias`,
  stockCategoria: (orgId: string, id: string) =>
    `organizations/${orgId}/fin_stock_categorias/${id}`,

  stockProductos: (orgId: string) =>
    `organizations/${orgId}/fin_stock_productos`,
  stockProducto: (orgId: string, id: string) =>
    `organizations/${orgId}/fin_stock_productos/${id}`,

  stockMovimientos: (orgId: string) =>
    `organizations/${orgId}/fin_stock_movimientos`,
  stockMovimiento: (orgId: string, id: string) =>
    `organizations/${orgId}/fin_stock_movimientos/${id}`,

  stockMovimientosProducto: (orgId: string, productoId: string) =>
    `organizations/${orgId}/fin_stock_movimientos?producto_id=${productoId}`,
```

NO modificar nada más en ese archivo.

Criterio de éxito: `tsc --noEmit` sin errores de tipo en los archivos nuevos/modificados.
```

---

### Agente B — Capability `stock_mercaderia`

**Puede ejecutarse en paralelo con:** Agente A
**Depende de:** nada — es la primera ola

#### Objetivo
Agregar la capability `STOCK_MERCADERIA` en `src/lib/capabilities.ts` para que el plugin
sea activable por organización.

#### Archivos a modificar
- `src/lib/capabilities.ts` — agregar nueva capability y su entrada en PLUGIN_CAPABILITIES

#### Prompt completo para el agente

```
Sos un agente de desarrollo trabajando en "prestaloapp", fintech SaaS multi-tenant.
Stack: Next.js 16 + TypeScript strict.

Tu ÚNICA tarea: modificar `src/lib/capabilities.ts`.

Lee el archivo actual. Tiene:
  - Un objeto `CAPABILITIES` con constantes string
  - Un tipo `Capability`
  - Un array `PLUGIN_CAPABILITIES` con objetos { value, label, description }

Cambios a aplicar:

1. En el objeto CAPABILITIES agrega (después de CTA_CTE_COMERCIAL):
   STOCK_MERCADERIA: 'stock_mercaderia',

2. En el array PLUGIN_CAPABILITIES agrega (al final, antes del cierre `]`):
   {
     value: CAPABILITIES.STOCK_MERCADERIA,
     label: 'Stock de Mercadería',
     description: 'Catálogo de productos, control de inventario y descuento automático de stock en ventas financiadas y cta. cte.',
   },

NO modificar nada más. NO crear archivos nuevos.

Criterio de éxito: el tipo Capability se actualiza automáticamente (es un mapped type).
Verificar con tsc --noEmit.
```

---

## Ola 2 — Servicio de dominio StockService

> Ejecutar **SOLO después de que Ola 1 esté completa**
> Solo tiene un agente

---

### Agente A — StockService.ts

**Puede ejecutarse en paralelo con:** es el único de esta ola
**Depende de:** Ola 1 completa (types + collections)

#### Objetivo
Crear `src/services/StockService.ts` con toda la lógica de negocio del plugin de stock:
CRUD de categorías, productos y el movimiento transaccional de stock.

#### Archivos a crear
- `src/services/StockService.ts` — servicio completo con métodos de dominio

#### Archivos a leer como modelo
- `src/services/CtaCteService.ts` — patrón de servicio con Firestore admin
- `src/services/PlanFinanciacionService.ts` — patrón de CRUD simple
- `src/firebase/admin.ts` — `getAdminFirestore()` que se debe importar
- `src/firebase/collections.ts` — rutas a usar (FIN_COLLECTIONS.stockCategorias, etc.)
- `src/types/fin-stock.ts` — tipos que se crearon en Ola 1

#### Prompt completo para el agente

```
Sos un agente de desarrollo trabajando en "prestaloapp", fintech SaaS multi-tenant.
Stack: Next.js 16 + TypeScript strict + Firebase Admin 13 Firestore.

Tu ÚNICA tarea: crear src/services/StockService.ts

━━━━ PATRONES OBLIGATORIOS ━━━━
- Importar Firestore admin: `import { getAdminFirestore } from '@/firebase/admin'`
- Importar colecciones: `import { FIN_COLLECTIONS } from '@/firebase/collections'`
- Importar tipos desde: `import { ... } from '@/types/fin-stock'`
- Todas las fechas con: `new Date().toISOString()`
- IDs de documentos: `db.collection(...).doc().id` (Firestore auto-id)
- Transacciones para movimientos de stock (para mantener stock_actual consistente)
- Usar `FieldValue.serverTimestamp()` NO — usar ISO string siempre
- Exportar como clase con métodos estáticos (igual que CtaCteService)

━━━━ MÉTODOS A IMPLEMENTAR ━━━━

// ── Categorías ──
static async getCategorias(orgId: string): Promise<FinStockCategoria[]>
  // Query: collectionRef, orderBy createdAt desc

static async getCategoria(orgId: string, id: string): Promise<FinStockCategoria | null>

static async createCategoria(orgId: string, data: FinStockCategoriaInput, userId: string): Promise<FinStockCategoria>
  // Genera ID, agrega organization_id, createdAt, createdBy

static async updateCategoria(orgId: string, id: string, data: Partial<FinStockCategoriaInput>): Promise<void>

static async desactivarCategoria(orgId: string, id: string): Promise<void>
  // Solo cambia activa: false, no borra

// ── Productos ──
static async getProductos(orgId: string, filtros?: { categoriaId?: string; activo?: boolean; soloConStock?: boolean }): Promise<FinStockProducto[]>

static async getProducto(orgId: string, id: string): Promise<FinStockProducto | null>

static async createProducto(orgId: string, data: FinStockProductoInput, userId: string): Promise<FinStockProducto>
  // stock_actual empieza en 0

static async updateProducto(orgId: string, id: string, data: Partial<FinStockProductoInput>): Promise<void>
  // Actualiza updatedAt al modificar

static async desactivarProducto(orgId: string, id: string): Promise<void>

// ── Movimientos de Stock (core del plugin) ──
static async getMovimientos(orgId: string, filtros?: { productoId?: string; tipo?: FinMovimientoStockTipo; desde?: string; hasta?: string }): Promise<FinMovimientoStock[]>

static async registrarMovimiento(
  orgId: string,
  data: FinMovimientoStockInput,
  userId: string
): Promise<FinMovimientoStock>
/*
  Implementar con Firestore transaction:
  1. Lee el producto con db.runTransaction
  2. Calcula nuevo stock:
     - Si tipo está en FIN_MOVIMIENTO_INGRESO_TIPOS → stock + cantidad
     - Si no (egreso) → stock - cantidad
  3. Valida que stock no quede negativo (throw Error('Stock insuficiente'))
  4. Actualiza producto.stock_actual y producto.updatedAt
  5. Crea documento en fin_stock_movimientos con stock_anterior y stock_nuevo
  Retorna el movimiento creado
*/

// ── Helpers ──
static async getResumenStock(orgId: string): Promise<FinStockResumen[]>
/*
  Lee todos los productos activos y mapea a FinStockResumen.
  alerta_stock_bajo = stock_actual <= stock_minimo
*/

Criterio de éxito:
- Sin errores de TypeScript (tsc --noEmit)
- Todas las funciones compiladas correctamente
- NO crear páginas UI ni API routes (eso va en otras olas)
```

---

## Ola 3 — API Routes

> Ejecutar **SOLO después de que Ola 2 esté completa**
> Ejecutar **Agente A + Agente B + Agente C** en PARALELO

---

### Agente A — API Routes de Categorías

**Puede ejecutarse en paralelo con:** Agente B, Agente C
**Depende de:** Ola 2 completa (StockService)

#### Objetivo
Crear las rutas REST para ABM de categorías de stock.

#### Archivos a crear
- `src/app/api/fin/stock/categorias/route.ts` — GET (listar) + POST (crear)
- `src/app/api/fin/stock/categorias/[id]/route.ts` — GET (detalle) + PUT (editar) + DELETE (desactivar)

#### Archivos a leer como modelo
- `src/app/api/fin/plan-cuentas/config/route.ts` — patrón de withAuth + NextResponse
- `src/lib/api/withAuth.ts` — wrapper que inyecta organizationId y userId
- `src/services/StockService.ts` — métodos a llamar

#### Prompt completo para el agente

```
Sos un agente de desarrollo trabajando en "prestaloapp".
Stack: Next.js 16 App Router + TypeScript strict + Firebase Admin.

Tu ÚNICA tarea: crear las API routes de categorías de stock.

━━━━ PATRONES OBLIGATORIOS ━━━━
- Todas las routes usan `withAuth` wrapper importado de '@/lib/api/withAuth'
- withAuth inyecta: { organizationId, userId, role }
- Siempre exportar `export const dynamic = "force-dynamic"`
- Errores: NextResponse.json({ error: '...' }, { status: 400/404/500 })
- Éxito: NextResponse.json({ ... })

━━━━ ARCHIVO 1: src/app/api/fin/stock/categorias/route.ts ━━━━

export const dynamic = "force-dynamic"

GET = withAuth(async (_req, _ctx, { organizationId }) => {
  // Llama StockService.getCategorias(organizationId)
  // Retorna: { categorias: FinStockCategoria[] }
})

POST = withAuth(async (req, _ctx, { organizationId, userId }) => {
  // Body: FinStockCategoriaInput
  // Valida: nombre requerido, rubro requerido
  // Llama StockService.createCategoria(organizationId, body, userId)
  // Retorna: { categoria }
  // Solo roles admin o manager pueden crear
}, { roles: ['admin', 'manager'] })

━━━━ ARCHIVO 2: src/app/api/fin/stock/categorias/[id]/route.ts ━━━━

GET = withAuth(async (_req, ctx, { organizationId }) => {
  const id = ctx.params.id
  // Llama StockService.getCategoria(organizationId, id)
  // Si null: 404
  // Retorna: { categoria }
})

PUT = withAuth(async (req, ctx, { organizationId }) => {
  const id = ctx.params.id
  // Body: Partial<FinStockCategoriaInput>
  // Llama StockService.updateCategoria(organizationId, id, body)
  // Retorna: { ok: true }
}, { roles: ['admin', 'manager'] })

DELETE = withAuth(async (_req, ctx, { organizationId }) => {
  const id = ctx.params.id
  // Llama StockService.desactivarCategoria(organizationId, id)
  // Retorna: { ok: true }
  // NOTA: no borra el documento, solo desactiva
}, { roles: ['admin', 'manager'] })

Criterio de éxito: tsc --noEmit sin errores en estos archivos.
```

---

### Agente B — API Routes de Productos

**Puede ejecutarse en paralelo con:** Agente A, Agente C
**Depende de:** Ola 2 completa (StockService)

#### Objetivo
Crear las rutas REST para ABM de productos y resumen de stock.

#### Archivos a crear
- `src/app/api/fin/stock/productos/route.ts` — GET (listar con filtros) + POST (crear)
- `src/app/api/fin/stock/productos/[id]/route.ts` — GET + PUT + DELETE (desactivar)
- `src/app/api/fin/stock/resumen/route.ts` — GET resumen de stock para dashboard

#### Archivos a leer como modelo
- `src/app/api/fin/plan-cuentas/config/route.ts` — patrón general
- `src/services/StockService.ts` — métodos a llamar

#### Prompt completo para el agente

```
Sos un agente de desarrollo trabajando en "prestaloapp".
Stack: Next.js 16 App Router + TypeScript strict.

Tu ÚNICA tarea: crear las API routes de productos de stock.

Mismo patrón que las routes de categorías (withAuth, dynamic, NextResponse).

━━━━ ARCHIVO 1: src/app/api/fin/stock/productos/route.ts ━━━━

GET = withAuth(async (req, _ctx, { organizationId }) => {
  // Query params: categoriaId?, activo? (default: true), soloConStock?
  const url = new URL(req.url)
  const categoriaId = url.searchParams.get('categoriaId') || undefined
  const soloConStock = url.searchParams.get('soloConStock') === 'true'
  // activo siempre true por defecto en listado
  const productos = await StockService.getProductos(organizationId, { categoriaId, activo: true, soloConStock })
  return NextResponse.json({ productos })
})

POST = withAuth(async (req, _ctx, { organizationId, userId }) => {
  const body = await req.json() as FinStockProductoInput
  // Validar: nombre, codigo, categoria_id, precio_venta_contado >= 0, stock_minimo >= 0
  if (!body.nombre || !body.codigo || !body.categoria_id) {
    return NextResponse.json({ error: 'Nombre, código y categoría son requeridos' }, { status: 400 })
  }
  const producto = await StockService.createProducto(organizationId, body, userId)
  return NextResponse.json({ producto })
}, { roles: ['admin', 'manager'] })

━━━━ ARCHIVO 2: src/app/api/fin/stock/productos/[id]/route.ts ━━━━

GET = withAuth → StockService.getProducto → { producto } o 404

PUT = withAuth(admin/manager) → StockService.updateProducto → { ok: true }

DELETE = withAuth(admin/manager) → StockService.desactivarProducto → { ok: true }

━━━━ ARCHIVO 3: src/app/api/fin/stock/resumen/route.ts ━━━━

GET = withAuth(async (_req, _ctx, { organizationId }) => {
  const resumen = await StockService.getResumenStock(organizationId)
  // También calcular alertas:
  const alertas = resumen.filter(r => r.alerta_stock_bajo).length
  return NextResponse.json({ resumen, alertas })
})

Criterio de éxito: tsc --noEmit sin errores.
```

---

### Agente C — API Routes de Movimientos

**Puede ejecutarse en paralelo con:** Agente A, Agente B
**Depende de:** Ola 2 completa (StockService)

#### Objetivo
Crear las rutas REST para registrar y consultar movimientos de stock.

#### Archivos a crear
- `src/app/api/fin/stock/movimientos/route.ts` — GET (listar con filtros) + POST (registrar movimiento)

#### Archivos a leer como modelo
- `src/app/api/fin/plan-cuentas/config/route.ts` — patrón general
- `src/services/StockService.ts` — `registrarMovimiento` y `getMovimientos`
- `src/types/fin-stock.ts` — `FinMovimientoStockInput`, `FIN_MOVIMIENTO_INGRESO_TIPOS`

#### Prompt completo para el agente

```
Sos un agente de desarrollo trabajando en "prestaloapp".
Stack: Next.js 16 App Router + TypeScript strict.

Tu ÚNICA tarea: crear src/app/api/fin/stock/movimientos/route.ts

export const dynamic = "force-dynamic"

GET = withAuth(async (req, _ctx, { organizationId }) => {
  const url = new URL(req.url)
  const filtros = {
    productoId: url.searchParams.get('productoId') || undefined,
    tipo: url.searchParams.get('tipo') as FinMovimientoStockTipo | undefined,
    desde: url.searchParams.get('desde') || undefined,
    hasta: url.searchParams.get('hasta') || undefined,
  }
  const movimientos = await StockService.getMovimientos(organizationId, filtros)
  return NextResponse.json({ movimientos })
})

POST = withAuth(async (req, _ctx, { organizationId, userId }) => {
  const body = await req.json() as FinMovimientoStockInput
  // Validar:
  if (!body.producto_id) return 400 'producto_id requerido'
  if (!body.tipo) return 400 'tipo requerido'
  if (!body.cantidad || body.cantidad <= 0) return 400 'cantidad debe ser > 0'

  try {
    const movimiento = await StockService.registrarMovimiento(organizationId, body, userId)
    return NextResponse.json({ movimiento })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error al registrar movimiento'
    // Si msg contiene 'Stock insuficiente' → 422
    const status = msg.includes('insuficiente') ? 422 : 500
    return NextResponse.json({ error: msg }, { status })
  }
}, { roles: ['admin', 'manager', 'operador'] })

Criterio de éxito: tsc --noEmit sin errores.
```

---

## Ola 4 — UI Pages

> Ejecutar **SOLO después de que Ola 3 esté completa**
> Ejecutar **Agente A + Agente B + Agente C** en PARALELO

---

### Agente A — Páginas de Catálogo (Categorías + Productos)

**Puede ejecutarse en paralelo con:** Agente B, Agente C
**Depende de:** Ola 3 completa (API routes)

#### Objetivo
Crear las páginas de gestión del catálogo de productos con su UI.

#### Archivos a crear
- `src/app/(dashboard)/stock/categorias/page.tsx` — listado + modal crear/editar categoría
- `src/app/(dashboard)/stock/productos/page.tsx` — listado de productos con stock badge
- `src/app/(dashboard)/stock/productos/nuevo/page.tsx` — formulario de nuevo producto
- `src/app/(dashboard)/stock/productos/[id]/page.tsx` — detalle y edición de producto

#### Archivos a leer como modelo
- `src/app/(dashboard)/cta-corriente/page.tsx` — patrón de listado con DataTable
- `src/app/(dashboard)/ventas-financiadas/page.tsx` — patrones de tabla y estados
- `src/components/ui/data-table.tsx` — componente reutilizable DataTable
- `src/types/fin-stock.ts` — tipos a usar

#### Prompt completo para el agente

```
Sos un agente de desarrollo trabajando en "prestaloapp".
Stack: Next.js 16 + React 19 + TypeScript strict + Tailwind v4 + Radix UI + lucide-react.

Tu tarea: crear las páginas UI del catálogo de stock.

━━━━ PATRONES DE DISEÑO OBLIGATORIOS ━━━━
- Fondo base: bg-slate-950 (no bg-gray)
- Cards: bg-slate-900 border border-slate-800 rounded-2xl
- Textos: text-white (títulos), text-slate-300 (labels), text-slate-400 (secundario)
- Accent principal: text-amber-400 / bg-amber-500
- Alertas/badges stock bajo: text-red-400 bg-red-500/10 border border-red-500/20
- Badge stock OK: text-emerald-400 bg-emerald-500/10 border border-emerald-500/20
- Siempre "use client" en páginas con hooks
- Fetch con apiFetch de '@/lib/apiFetch'
- Loading states con skeleton o spinner

━━━━ src/app/(dashboard)/stock/categorias/page.tsx ━━━━

Listado de categorías. Columnas: Nombre, Rubro (badge con etiqueta de FIN_STOCK_RUBRO_LABELS),
Descripción, Estado (Activa/Inactiva badge). Botón "Nueva categoría" abre Dialog inline
con campos: nombre (required), descripcion, rubro (Select con opciones), activa (default true).
Al guardar: POST /api/fin/stock/categorias. Dialog también sirve para editar (PUT .../[id]).
Botón desactivar con confirmación (Dialog).

━━━━ src/app/(dashboard)/stock/productos/page.tsx ━━━━

Listado de productos. Columnas: Código, Nombre, Categoría, Stock Actual (con badge color),
Precio Venta, Estado.
- Badge stock: si stock_actual <= stock_minimo → badge rojo "Stock bajo"; si > minimo → badge verde
- Filtros: por categoría (Select) + soloConStock (checkbox)
- Botón "Nuevo producto" → /stock/productos/nuevo
- Click en fila → /stock/productos/[id]
- Card de resumen arriba: total productos, alertas de stock bajo (con número)

━━━━ src/app/(dashboard)/stock/productos/nuevo/page.tsx ━━━━

Formulario de alta de producto con react-hook-form + zod:
Campos: codigo (req), nombre (req), descripcion, marca, modelo,
categoria_id (Select que carga GET /api/fin/stock/categorias),
unidad_medida (Select con FIN_STOCK_UNIDAD_LABELS),
precio_costo (number, opcional), precio_venta_contado (number, req, >= 0),
stock_minimo (number, req, default 0), requiere_serie (checkbox).
Submit → POST /api/fin/stock/productos → redirect a /stock/productos.

━━━━ src/app/(dashboard)/stock/productos/[id]/page.tsx ━━━━

Detalle del producto con:
- Datos del producto (editables inline con botón "Editar")
- Stock actual prominente con badge de color
- Tabla de últimos 20 movimientos (GET /api/fin/stock/movimientos?productoId=X)
  Columnas: Fecha, Tipo (FIN_MOVIMIENTO_TIPO_LABELS), Cantidad (+/-), Stock resultante,
  Referencia (número de crédito/ctacte si existe)

Criterio de éxito: tsc --noEmit sin errores. Las páginas renderizan sin crash.
```

---

### Agente B — Páginas de Movimientos e Ingresos

**Puede ejecutarse en paralelo con:** Agente A, Agente C
**Depende de:** Ola 3 completa (API routes)

#### Objetivo
Crear la página de historial de movimientos y el formulario de ingreso de mercadería.

#### Archivos a crear
- `src/app/(dashboard)/stock/movimientos/page.tsx` — historial completo de movimientos
- `src/app/(dashboard)/stock/ingresos/nueva/page.tsx` — formulario para ingresar stock (compra proveedor)
- `src/app/(dashboard)/stock/page.tsx` — dashboard/home del plugin de stock

#### Archivos a leer como modelo
- `src/app/(dashboard)/cobros/page.tsx` — patrón de listado con filtros
- `src/app/(dashboard)/cta-corriente/control-mensual/page.tsx` — patrones de página operacional
- `src/types/fin-stock.ts` — tipos

#### Prompt completo para el agente

```
Sos un agente de desarrollo trabajando en "prestaloapp".
Stack: Next.js 16 + React 19 + TypeScript strict + Tailwind v4.
Mismos patrones de diseño: bg-slate-950, cards bg-slate-900, accent amber-400.

Tu tarea: crear 3 páginas del plugin de stock.

━━━━ src/app/(dashboard)/stock/page.tsx ━━━━
Dashboard del plugin. Muestra:
- 4 KPI cards:
  1. Total productos activos (GET /api/fin/stock/productos, contar)
  2. Alertas de stock bajo (GET /api/fin/stock/resumen → alertas)
  3. Últimos 7 días: ingresos (contar movimientos tipo ingreso_*)
  4. Últimos 7 días: egresos (contar movimientos tipo egreso_*)
- Tabla "Stock bajo" (productos con alerta): columnas Producto, Categoría, Stock actual, Stock mínimo
- Acceso rápido: botones a /stock/productos, /stock/ingresos/nueva, /stock/movimientos

━━━━ src/app/(dashboard)/stock/movimientos/page.tsx ━━━━
Historial completo. Columnas: Fecha, Producto, Tipo (badge), Cantidad (verde/rojo según ingreso/egreso),
Stock resultante, Referencia, Notas.
Filtros en la parte superior:
- Fecha desde/hasta (input type date)
- Tipo (Select multi con las opciones de FinMovimientoStockTipo)
- Producto (Select que carga la lista)
Fetch: GET /api/fin/stock/movimientos con params de filtro.
La cantidad se muestra con + o − según tipo (ingreso = verde +N, egreso = rojo −N).

━━━━ src/app/(dashboard)/stock/ingresos/nueva/page.tsx ━━━━
Formulario para registrar un ingreso de mercadería (compra a proveedor).
Campos:
- producto_id: Select que carga GET /api/fin/stock/productos (muestra "Código - Nombre [stock actual]")
- tipo: fijado como 'ingreso_compra' por defecto, pero permite cambiar a
  'ingreso_devolucion_cliente' o 'ingreso_ajuste' (Select con esas 3 opciones solamente)
- cantidad: number > 0
- costo_unitario: number opcional (precio pagado al proveedor)
- notas: textarea opcional
- numero_serie: text opcional (visible solo si el producto requiere_serie)

Al hacer submit: POST /api/fin/stock/movimientos
En éxito: mostrar toast con "Ingresadas N unidades de [producto]. Stock actual: X"
y botón para "Registrar otro ingreso" o "Ver stock".

Criterio de éxito: tsc --noEmit sin errores. Formularios con validación Zod.
```

---

### Agente C — Sidebar + Navegación del Plugin

**Puede ejecutarse en paralelo con:** Agente A, Agente B
**Depende de:** Ola 3 completa (tipo TS para capability)

#### Objetivo
Actualizar el Sidebar para incluir la sección de Stock (gateada por `stock_mercaderia`).
También agregar el redirect `src/app/(dashboard)/stock/page.tsx` layout si hace falta.

#### Archivos a modificar
- `src/components/layout/Sidebar.tsx` — agregar sección "Inventario" con items de stock

#### Prompt completo para el agente

```
Sos un agente de desarrollo trabajando en "prestaloapp".
Stack: Next.js 16 + TypeScript strict + lucide-react.

Tu ÚNICA tarea: modificar src/components/layout/Sidebar.tsx

Lee el archivo completo. Ya existe el patrón de capability-gated items:
  { href: '/cta-corriente', label: 'Cta. Cte. Financiada', icon: Wallet, capability: 'cta_cte_comercial' }

Cambios a aplicar:

1. Agregar imports de iconos (si no están ya):
   - Archive, PackageOpen, TrendingUp (de lucide-react)

2. Crear un nuevo array de navegación para stock (agrégalo después de operacionesItems):

const stockItems = [
  { href: '/stock',               label: 'Stock Dashboard',  icon: Archive,      capability: 'stock_mercaderia' },
  { href: '/stock/productos',     label: 'Productos',        icon: PackageOpen,  capability: 'stock_mercaderia' },
  { href: '/stock/ingresos/nueva',label: 'Nuevo ingreso',    icon: TrendingUp,   capability: 'stock_mercaderia' },
  { href: '/stock/movimientos',   label: 'Movimientos',      icon: FileText,     capability: 'stock_mercaderia' },
];

3. En el JSX del Sidebar, agregar la sección después de la sección "Operaciones":
   Usar exactamente el mismo patrón CollapsibleSection que se usa para "Operaciones".
   Label: "Inventario"
   Ícono de la sección: Archive

4. Los items de stockItems deben filtrarse igual que los otros items con capability:
   verificar si la organización tiene habilitado 'stock_mercaderia'.
   (Ver cómo se filtran los items con capability en el código existente y replicar exactamente.)

NO modificar nada más. NO cambiar los items existentes.
Criterio de éxito: tsc --noEmit sin errores. El sidebar compila y renderiza.
```

---

## Ola 5 — Integración con Venta Financiada y Cta. Cte.

> Ejecutar **SOLO después de que Ola 4 esté completa**
> Ejecutar **Agente A + Agente B** en PARALELO

---

### Agente A — Integración en Venta Financiada

**Puede ejecutarse en paralelo con:** Agente B
**Depende de:** Ola 4 completa

#### Objetivo
Cuando se crea una Venta Financiada (`/ventas-financiadas`) y la organización tiene
`stock_mercaderia` activo, permitir seleccionar un producto del catálogo y descontar
automáticamente el stock al confirmar el crédito.

#### Archivos a modificar
- `src/components/fin/dialogs/NuevoCreditoDialog.tsx` — agregar campo "Producto del catálogo" opcional
- `src/app/api/fin/creditos/route.ts` (POST) — al crear un crédito, si viene `stock_producto_id`, registrar egreso

#### Archivos a leer
- `src/components/fin/dialogs/NuevoCreditoDialog.tsx` — entender los campos actuales
- `src/app/api/fin/creditos/route.ts` — entender el flujo POST actual
- `src/types/fin-stock.ts` — tipo `FinMovimientoStockInput`
- `src/services/StockService.ts` — `registrarMovimiento`

#### Prompt completo para el agente

```
Sos un agente de desarrollo trabajando en "prestaloapp".
Stack: Next.js 16 + TypeScript strict + React Hook Form.

Tu tarea: integrar el descuento de stock en la creación de créditos (Venta Financiada).

━━━━ PARTE 1: NuevoCreditoDialog.tsx ━━━━

Lee el componente completo. Tiene un formulario para crear créditos de tipo "compra_financiada".

Agrega un campo OPCIONAL al final del formulario (antes del submit):

"Producto del catálogo de stock" — combobox/Select que:
- Solo se muestra si el tipo de crédito es 'compra_financiada'
- Carga los productos via: GET /api/fin/stock/productos?soloConStock=true
- Muestra: "SKU - Nombre [stock: N unidades]"
- El campo es OPCIONAL (no rompe la creación de crédito si no se selecciona)
- Cuando se selecciona, AUTO-COMPLETA el campo "articulo_descripcion" del formulario
  con el nombre del producto seleccionado
- Guarda el producto_id seleccionado en un campo hidden (no Zod, solo useState)

Al hacer submit, incluir en el body del POST: `stock_producto_id: string | undefined`

━━━━ PARTE 2: src/app/api/fin/creditos/route.ts ━━━━

Lee el POST handler actual. Después de crear el crédito exitosamente, agregar:

```typescript
// Descuento de stock si aplica
if (body.stock_producto_id && body.tipo === 'compra_financiada') {
  try {
    const producto = await StockService.getProducto(organizationId!, body.stock_producto_id)
    if (producto) {
      await StockService.registrarMovimiento(organizationId!, {
        producto_id: body.stock_producto_id,
        producto_nombre: producto.nombre,
        tipo: 'egreso_venta_financiada',
        cantidad: 1,
        referencia_id: creditoId,         // ID del crédito recién creado
        referencia_tipo: 'credito',
        referencia_numero: nuevoCreditoNumero, // número del crédito
        precio_unitario: body.valor_contado_bien || producto.precio_venta_contado,
      }, userId!)
    }
  } catch (stockErr) {
    // El crédito ya se creó; loguear pero no hacer rollback
    console.error('[stock] Error al descontar stock:', stockErr)
  }
}
```

IMPORTANTE: El descuento de stock es "best effort" — si falla, NO se hace rollback del crédito.
Solo se loguea el error.

Criterio de éxito: tsc --noEmit sin errores. El flujo de venta financiada sigue funcionando
aunque el stock no esté configurado.
```

---

### Agente B — Integración en Cuenta Corriente Financiada

**Puede ejecutarse en paralelo con:** Agente A
**Depende de:** Ola 4 completa

#### Objetivo
En el formulario de nueva operación de Cta. Cte. (`/cta-corriente/nueva`), agregar
la posibilidad de adjuntar uno o más productos del catálogo. Al guardar la operación,
se descuenta el stock de cada producto adjuntado.

#### Archivos a modificar
- `src/app/(dashboard)/cta-corriente/nueva/page.tsx` — agregar sección "Mercadería incluida"
- `src/app/api/fin/ctacte/operaciones/route.ts` (POST) — registrar egresos de stock

#### Archivos a leer
- `src/app/(dashboard)/cta-corriente/nueva/page.tsx` — formulario actual completo
- `src/app/api/fin/ctacte/operaciones/route.ts` — handler POST actual
- `src/types/fin-stock.ts` — tipos
- `src/services/StockService.ts` — `registrarMovimiento`

#### Prompt completo para el agente

```
Sos un agente de desarrollo trabajando en "prestaloapp".
Stack: Next.js 16 + TypeScript strict.

Tu tarea: integrar selección de productos en la nueva operación de Cta. Cte.

━━━━ PARTE 1: /cta-corriente/nueva/page.tsx ━━━━

Lee el formulario completo. Usa react-hook-form.

Agrega una sección OPCIONAL al final del formulario:

"Mercadería incluida en la operación"
- Un botón "+ Agregar producto"
- Al click: abre un mini-panel inline (no Dialog) con:
  - Select de producto (GET /api/fin/stock/productos?soloConStock=true)
    Muestra: "SKU - Nombre [stock: N]"
  - Input cantidad (number, default 1, min 1)
  - Botón "Agregar"
- Los productos agregados se muestran como una lista con:
  - Nombre, cantidad, precio unitario (del producto), subtotal
  - Botón X para quitar
- Manejo de estado local: useState<Array<{ productoId, nombre, cantidad, precioUnitario }>>
- Esta lista se envía como `mercaderia_items` en el body del POST

━━━━ PARTE 2: src/app/api/fin/ctacte/operaciones/route.ts ━━━━

Lee el POST handler. Después de crear la operación ctacte exitosamente, agregar:

```typescript
// Descuento de stock para cada ítem de mercadería
if (Array.isArray(body.mercaderia_items) && body.mercaderia_items.length > 0) {
  for (const item of body.mercaderia_items) {
    try {
      const producto = await StockService.getProducto(organizationId!, item.productoId)
      if (producto) {
        await StockService.registrarMovimiento(organizationId!, {
          producto_id: item.productoId,
          producto_nombre: producto.nombre,
          tipo: 'egreso_venta_ctacte',
          cantidad: item.cantidad,
          referencia_id: operacionId,
          referencia_tipo: 'ctacte',
          referencia_numero: operacionNumero,
          precio_unitario: item.precioUnitario,
        }, userId!)
      }
    } catch (err) {
      console.error('[stock] Error al descontar item:', item.productoId, err)
    }
  }
}
```

Mismo patrón best-effort: si el stock falla, la operación de cta-cte no se revierte.

Criterio de éxito: tsc --noEmit sin errores. El flujo de nueva operación ctacte sigue
funcionando normalmente si no hay mercadería seleccionada.
```

---

## Verificación final

### Checklist técnico

- [ ] `tsc --noEmit` → 0 errores TypeScript
- [ ] `next build` → build verde sin errores
- [ ] Nueva capability `stock_mercaderia` aparece en `/configuracion/plugins`
- [ ] Sidebar muestra sección "Inventario" solo si la org tiene el plugin activo
- [ ] `/stock` carga el dashboard con KPIs
- [ ] `/stock/categorias` — CRUD completo funciona
- [ ] `/stock/productos` — CRUD completo, badge de stock bajo funciona
- [ ] `/stock/ingresos/nueva` — registra movimiento y actualiza `stock_actual` en el producto
- [ ] `/stock/movimientos` — muestra historial con filtros
- [ ] `/ventas-financiadas` → nueva venta financiada descuenta 1 unidad del producto seleccionado
- [ ] `/cta-corriente/nueva` → nueva operación descuenta ítems de mercadería
- [ ] Un movimiento de stock registra correctamente `stock_anterior` y `stock_nuevo`
- [ ] Intentar egresar más stock del disponible retorna error 422

### Checklist de negocio

- [ ] Producto sin stock suficiente muestra badge rojo y no puede usarse en ventas
- [ ] Ingreso de mercadería suma al `stock_actual` del producto inmediatamente
- [ ] El historial de movimientos muestra la referencia al crédito/ctacte correspondiente
- [ ] La capability puede activarse/desactivarse desde `/configuracion/plugins`
  (sin afectar datos existentes)

---

## Notas de implementación

### Sobre el `stock_actual` desnormalizado
El campo `stock_actual` en `fin_stock_productos` se actualiza dentro de una **Firestore
transaction** en cada `registrarMovimiento`. Esto garantiza consistencia bajo concurrencia.
Si una transacción falla, el documento de movimiento NO se crea → no hay inconsistencia.

### Sobre la integración "best-effort"
El descuento de stock en venta financiada y cta-cte es intencionalmente best-effort:
si el crédito/operación ya fue creado y el descuento de stock falla (ej: race condition
o stock insuficiente), se loguea el error pero NO se hace rollback de la operación financiera.
Esto evita que un problema de stock bloquee operaciones de crédito.

### Sobre las colecciones Firestore
Las 3 nuevas colecciones van bajo `organizations/{orgId}/`:
- `fin_stock_categorias`
- `fin_stock_productos`
- `fin_stock_movimientos`

Agregar los índices necesarios en `firestore.indexes.json`:
```json
{
  "collectionGroup": "fin_stock_movimientos",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "organization_id", "order": "ASCENDING" },
    { "fieldPath": "producto_id", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
},
{
  "collectionGroup": "fin_stock_productos",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "organization_id", "order": "ASCENDING" },
    { "fieldPath": "categoria_id", "order": "ASCENDING" },
    { "fieldPath": "activo", "order": "ASCENDING" }
  ]
}
```
