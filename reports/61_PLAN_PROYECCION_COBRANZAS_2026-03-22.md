# Plan OLA 10 — Proyección de Cobranzas (Flujo de Fondos Esperado)

> **Fecha:** 2026-03-22
> **Ruta objetivo:** `/reportes/proyeccion-cobranzas`
> **API objetivo:** `GET /api/fin/reportes/proyeccion-cobranzas`
> **Estado:** Planificado — pendiente de implementación

---

## 1. Análisis del estado actual del código

### 1.1 Modelo `FinCuota` (`src/types/fin-cuota.ts`)

```typescript
export type FinCuotaEstado = 'pendiente' | 'pagada' | 'vencida';

export interface FinCuota {
  id: string;
  organization_id: string;
  sucursal_id: string;        // ← filtrable
  credito_id: string;         // ← join con fin_creditos
  cliente_id: string;         // ← join con fin_clientes
  numero_cuota: number;
  fecha_vencimiento: string;  // ← YYYY-MM-DD, eje del reporte
  capital: number;
  interes: number;
  total: number;              // ← monto proyectado base
  saldo_capital_inicio: number;
  saldo_capital_fin: number;
  estado: FinCuotaEstado;     // ← filtro principal
  mora_calculada?: number;
  cobro_id?: string;          // ← si tiene cobro_id, está pagada
  fecha_pago?: string;
  created_at: string;
  updated_at: string;
}
```

**Conclusión crítica sobre `saldo_pendiente`:**
El modelo NO tiene campo `total_pagado` ni `saldo_pendiente`. El sistema no soporta pagos parciales por cuota — una cuota tiene `cobro_id` (pagada completa) o no lo tiene (pendiente/vencida).

**Por lo tanto:** `monto_proyectado = cuota.total` para todas las cuotas en estado `pendiente` o `vencida`.

### 1.2 Modelo `FinCredito` (`src/types/fin-credito.ts`)

Campos relevantes para filtros y joins:
- `sucursal_id` — filtro por sucursal
- `cliente_id` — join con cliente
- `tipo_cliente_id` — filtro por tipo de cliente
- `politica_crediticia_id` — filtro por política
- `plan_financiacion_id` — filtro por plan
- `estado: 'activo' | 'cancelado' | 'en_mora' | 'refinanciado' | 'incobrable'` — filtro de estado crédito
- `tipo_cliente_snapshot.nombre` — label del tipo cliente
- `politica_snapshot.nombre` — label de la política
- `plan_snapshot.nombre` — label del plan

### 1.3 Modelo `FinCliente` (`src/types/fin-cliente.ts`)

Campos relevantes:
- `tipo_cliente_id` — filtro por tipo
- `tipo_cliente_nombre` — label
- `clasificacion_interna` — agrupación secundaria

### 1.4 Colección Firestore

```
organizations/{orgId}/fin_cuotas   ← colección plana, consultable directamente
organizations/{orgId}/fin_creditos
organizations/{orgId}/fin_clientes
organizations/{orgId}/fin_tipos_cliente
organizations/{orgId}/fin_sucursales
```

La colección `fin_cuotas` es **plana a nivel de organización**, por lo que es consultable con un solo query (no es subcollection de crédito).

### 1.5 Patrón API existente

```typescript
export const dynamic = 'force-dynamic'
export const GET = withAuth(async (_req, _ctx, { organizationId }) => {
  const db = getAdminFirestore()
  // query Firestore → aggregar en backend → devolver JSON
})
```

### 1.6 Patrón página de reportes existente

```typescript
'use client'
// apiFetch() del lado cliente
// useState + useEffect
// No hay filtros dinámicos en el reporte actual (todos son server-side fijos)
```

---

## 2. Decisiones de diseño

### 2.1 Monto proyectado

```
monto_proyectado = cuota.total
```

No hay pagos parciales en el modelo actual. Cualquier cuota sin `cobro_id` y en estado `pendiente` o `vencida` se proyecta por su valor completo.

### 2.2 Cuotas vencidas impagas

Las cuotas con `estado === 'vencida'` y sin `cobro_id` son **deuda real existente, no cobrada**. Se muestran en columna separada `"Vencido"` (antes del primer mes futuro), no en su mes original, para no contaminar la proyección futura con deuda ya atrasada.

El usuario puede optar por:
- Verlas en columna `"Vencido acumulado"` al inicio de la tabla (default)
- Excluirlas completamente del reporte (filtro `incluir_vencidas = false`)

### 2.3 Dónde hacer la aggregación

**En el backend (API route).** Motivo: Firestore no soporta aggregaciones complejas cross-collection. El backend trae las cuotas filtradas, hace join con créditos y clientes en memoria, agrupa por mes y agrupador seleccionado, y devuelve la estructura ya calculada.

Para carteras grandes (>5.000 cuotas), usar `select()` para traer solo los campos necesarios de `fin_clientes` y `fin_creditos`.

### 2.4 Restricción de Firestore

Firestore no permite `where` compuesto con `in` + `range` en el mismo campo. Estrategia:

```
Query 1: fin_cuotas where estado == 'pendiente' AND fecha_vencimiento >= hoy AND fecha_vencimiento <= endDate
Query 2: fin_cuotas where estado == 'vencida'   (sin filtro de fecha, traer todas)
```

Luego filtrar y unir en memoria en el servicio.

### 2.5 Sin entidad "grupo de clientes"

`grupo_cliente` no existe en el modelo actual. El plan contempla agrupación por `tipo_cliente_id` (que es el equivalente funcional más cercano) y `clasificacion_interna`. Se deja el campo `grupo_cliente_id` reservado en los filtros de la API para implementación futura sin romper el contrato.

---

## 3. Tipos TypeScript nuevos

**Archivo:** `src/types/fin-proyeccion-cobranzas.ts`

```typescript
export type ProyeccionAgruparPor =
  | 'cliente'
  | 'tipo_cliente'
  | 'clasificacion_interna'
  | 'sucursal'
  | 'plan'
  | 'politica'
  | 'sin_agrupacion';

export interface ProyeccionCobranzasParams {
  fromMonth: string;           // YYYY-MM (default: mes actual)
  months: 6 | 12 | 18 | 24;  // columnas a mostrar
  agruparPor: ProyeccionAgruparPor;
  incluirVencidas: boolean;    // incluir cuotas vencidas impagas
  // filtros opcionales
  clienteId?: string;
  tipoClienteId?: string;
  clasificacionInterna?: string;
  sucursalId?: string;
  estadoCredito?: FinCreditoEstado | FinCreditoEstado[];
  planId?: string;
  politicaId?: string;
}

export interface ProyeccionCobranzasColumn {
  key: string;        // "vencido" | "2026-04" | "2026-05"...
  label: string;      // "Vencido" | "Abr 2026" | "May 2026"...
  isVencido?: boolean;
  startDate: string;
  endDate: string;
}

export interface ProyeccionCobranzasCell {
  monthKey: string;
  amount: number;
  cuotasCount: number;
}

export interface ProyeccionCobranzasRow {
  id: string;
  label: string;   // cliente.nombre | tipoCliente.nombre | sucursal.nombre | etc.
  meta: {
    clienteId?: string;
    tipoClienteId?: string;
    clasificacionInterna?: string;
    sucursalId?: string;
    planId?: string;
    politicaId?: string;
  };
  values: ProyeccionCobranzasCell[];
  total: number;
  cuotasTotal: number;
}

export interface ProyeccionCobranzasKpis {
  totalFuturo: number;
  vencidoImpago: number;
  proximoMes: number;
  proximos3Meses: number;
  proximos6Meses: number;
  cuotasPendientes: number;
  cuotasVencidas: number;
  clientesAlcanzados: number;
  promedioMensual: number;
}

export interface ProyeccionCobranzasResponse {
  columns: ProyeccionCobranzasColumn[];
  rows: ProyeccionCobranzasRow[];
  totalsByMonth: Record<string, number>;  // key → total ARS del mes
  grandTotal: number;
  kpis: ProyeccionCobranzasKpis;
  generatedAt: string;
  params: ProyeccionCobranzasParams;
}
```

---

## 4. Servicio backend

**Archivo:** `src/services/ProyeccionCobranzasService.ts`

### Algoritmo

```
1. Resolver ventana temporal
   - fromDate = primer día de fromMonth
   - toDate   = último día de fromMonth + (months - 1) meses

2. Query Firestore — cuotas pendientes futuras
   fin_cuotas
     WHERE estado == 'pendiente'
     AND fecha_vencimiento >= fromDate
     AND fecha_vencimiento <= toDate
     [AND sucursal_id == sucursalId si se filtró]
     [AND cliente_id == clienteId si se filtró]

3. Query Firestore — cuotas vencidas impagas (si incluirVencidas = true)
   fin_cuotas
     WHERE estado == 'vencida'
     [mismos filtros de sucursal/cliente si aplica]

4. Fetch bulk de créditos relacionados
   - Extraer set único de credito_ids de ambas queries
   - Traer fin_creditos con select('estado', 'tipo_cliente_id', 'plan_financiacion_id',
       'politica_crediticia_id', 'sucursal_id', 'tipo_cliente_snapshot', ...)
   - Filtrar por estado del crédito si se especificó
   - Filtrar por planId / politicaId si se especificó

5. Fetch bulk de clientes relacionados
   - Extraer set único de cliente_ids
   - Traer fin_clientes con select('nombre', 'tipo_cliente_id',
       'tipo_cliente_nombre', 'clasificacion_interna')
   - Filtrar por tipoClienteId / clasificacionInterna si se especificó

6. Cruzar datos
   - Para cada cuota: resolver crédito y cliente
   - Descartar cuota si su crédito fue filtrado fuera

7. Construir columnas
   - Columna "vencido" si incluirVencidas = true y existen vencidas
   - N columnas mensuales según ventana

8. Agrupar filas según agruparPor
   - clave de grupo → acumular cells por monthKey

9. Calcular KPIs

10. Construir respuesta
```

### Complejidad esperada

| Escenario | Cuotas | Créditos distintos | Clientes distintos |
|-----------|--------|-------------------|-------------------|
| Cartera chica | ~500 | ~100 | ~80 |
| Cartera media | ~5.000 | ~800 | ~600 |
| Cartera grande | ~20.000 | ~3.000 | ~2.000 |

Para cartera grande: usar `select()` en todos los fetches y limitar a 500 cuotas por batch si Firestore lo requiere.

---

## 5. API Route

**Archivo:** `src/app/api/fin/reportes/proyeccion-cobranzas/route.ts`

```typescript
export const dynamic = 'force-dynamic'

// GET /api/fin/reportes/proyeccion-cobranzas
// Query params: fromMonth, months, agruparPor, incluirVencidas,
//               clienteId, tipoClienteId, clasificacionInterna,
//               sucursalId, estadoCredito, planId, politicaId

export const GET = withAuth(async (req, _ctx, { organizationId }) => {
  const { searchParams } = new URL(req.url)
  // parsear y validar params con Zod
  // llamar ProyeccionCobranzasService.build(orgId, params)
  // devolver NextResponse.json(resultado)
})
```

### Schema de validación Zod

```typescript
const ProyeccionParamsSchema = z.object({
  fromMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  months: z.coerce.number().int().min(1).max(24).default(12),
  agruparPor: z.enum([
    'cliente', 'tipo_cliente', 'clasificacion_interna',
    'sucursal', 'plan', 'politica', 'sin_agrupacion'
  ]).default('tipo_cliente'),
  incluirVencidas: z.coerce.boolean().default(true),
  clienteId: z.string().optional(),
  tipoClienteId: z.string().optional(),
  clasificacionInterna: z.string().optional(),
  sucursalId: z.string().optional(),
  estadoCredito: z.string().optional(),  // "activo,en_mora" separado por coma
  planId: z.string().optional(),
  politicaId: z.string().optional(),
})
```

---

## 6. Página Frontend

**Archivo:** `src/app/(dashboard)/reportes/proyeccion-cobranzas/page.tsx`

### Layout general

```
┌─────────────────────────────────────────────────────────────────────┐
│  HEADER  Proyección de Cobranzas                                    │
├─────────────────────────────────────────────────────────────────────┤
│  FILTROS  [Tipo cliente▼] [Sucursal▼] [Plan▼] [Meses: 12▼]         │
│           [Agrupar por: Tipo cliente▼] [☑ Incluir vencidas]        │
├─────────────────────────────────────────────────────────────────────┤
│  KPIS   [Total futuro] [Próx. mes] [3 meses] [6 meses] [Vencido]  │
├─────────────────────────────────────────────────────────────────────┤
│  GRÁFICO  Barras mensuales de cobranza proyectada                   │
├─────────────────────────────────────────────────────────────────────┤
│  TABLA MATRIZ (scroll horizontal, primera col fija)                 │
│  ┌──────────────┬──────────┬──────────┬──────────┬──────────┬──────┤
│  │ Agrupación   │ Vencido  │ Abr 2026 │ May 2026 │ Jun 2026 │Total │
│  ├──────────────┼──────────┼──────────┼──────────┼──────────┼──────┤
│  │ Persona A    │  45.000  │  120.000 │  115.000 │  110.000 │  ...  │
│  │ Persona B    │  12.000  │   55.000 │   52.000 │   48.000 │  ...  │
│  │ Empresa A    │   8.000  │   90.000 │   90.000 │   90.000 │  ...  │
│  ├──────────────┼──────────┼──────────┼──────────┼──────────┼──────┤
│  │ TOTAL        │  65.000  │  265.000 │  257.000 │  248.000 │  ...  │
│  └──────────────┴──────────┴──────────┴──────────┴──────────┴──────┘
│  [Exportar Excel]
└─────────────────────────────────────────────────────────────────────┘
```

### Componentes a crear

| Componente | Archivo | Responsabilidad |
|------------|---------|----------------|
| `ProyeccionFiltros` | `components/fin-proyeccion/ProyeccionFiltros.tsx` | Panel de filtros con selects |
| `ProyeccionKpis` | `components/fin-proyeccion/ProyeccionKpis.tsx` | 5 cards KPI |
| `ProyeccionGrafico` | `components/fin-proyeccion/ProyeccionGrafico.tsx` | Barras con recharts o nativo |
| `ProyeccionTabla` | `components/fin-proyeccion/ProyeccionTabla.tsx` | Tabla matriz con scroll y col fija |
| `ProyeccionDetalle` | `components/fin-proyeccion/ProyeccionDetalle.tsx` | Drawer/modal de drill-down |

### Tabla Matriz — requisitos técnicos

```css
/* Primera columna fija */
.col-label {
  position: sticky;
  left: 0;
  z-index: 10;
  background: white;
  min-width: 200px;
}

/* Scroll horizontal en el contenedor */
.tabla-wrapper {
  overflow-x: auto;
  max-width: 100%;
}

/* Fila de totales resaltada */
.fila-total {
  font-weight: 700;
  background: #f8fafc;
  border-top: 2px solid #e2e8f0;
}
```

### Drill-down (click en celda)

Al hacer click en una celda `(tipo_cliente, mes)`:

```typescript
// Abrir un drawer lateral con detalle de cuotas
type DrilldownParams = {
  agrupadoPor: string;    // id del agrupador
  monthKey: string;       // "2026-04" o "vencido"
}
// GET /api/fin/reportes/proyeccion-cobranzas/detalle
// Devuelve lista de cuotas individuales con cliente, crédito, número de cuota, total
```

---

## 7. Exportación Excel

Usar `xlsx` (ya disponible en el ecosistema Next.js como `sheetjs`). Si no está instalado, instalar `xlsx`.

```typescript
// Función en el cliente
function exportarExcel(data: ProyeccionCobranzasResponse) {
  const wb = XLSX.utils.book_new()
  // Hoja 1: Matriz
  const matrizData = buildMatrizForExcel(data)
  const ws1 = XLSX.utils.aoa_to_sheet(matrizData)
  XLSX.utils.book_append_sheet(wb, ws1, 'Proyeccion')
  // Hoja 2: KPIs
  // ...
  XLSX.writeFile(wb, `proyeccion-cobranzas-${data.params.fromMonth}.xlsx`)
}
```

---

## 8. API de Detalle (drill-down)

**Archivo:** `src/app/api/fin/reportes/proyeccion-cobranzas/detalle/route.ts`

```
GET /api/fin/reportes/proyeccion-cobranzas/detalle
  ?agrupadoPorId=xxx
  &monthKey=2026-04
  &agruparPor=tipo_cliente
  [+ mismo juego de filtros que el reporte principal]
```

Devuelve lista plana de cuotas para el detalle:

```typescript
type DetalleCuotaRow = {
  cuotaId: string;
  clienteId: string;
  clienteNombre: string;
  cuit: string;
  creditoId: string;
  numeroCuota: number;
  fechaVencimiento: string;
  capital: number;
  interes: number;
  total: number;
  estado: FinCuotaEstado;
  diasMora?: number;
}
```

---

## 9. Navegación — Sidebar

Agregar entrada bajo el grupo "Reportes" en el sidebar:

```typescript
// En la config de sidebar (buscar donde está Reportes)
{
  href: '/reportes/proyeccion-cobranzas',
  label: 'Proyección de cobranzas',
  icon: CalendarDays,   // import de lucide-react
}
```

---

## 10. Casos especiales a resolver

| Caso | Resolución |
|------|------------|
| Cuota vencida impaga | Columna separada "Vencido" al inicio (no en su mes original) |
| Cuota con pago parcial | No aplica — el modelo no soporta pagos parciales |
| Crédito cancelado con cuotas pendientes | Filtrar: si crédito.estado = 'cancelado', excluir sus cuotas |
| Crédito refinanciado | Si `estado = 'refinanciado'`, excluir. Las nuevas cuotas vienen del crédito nuevo |
| Crédito incobrable | Excluir por defecto. El usuario puede activar un filtro para incluirlos |
| Sin agrupación | Una sola fila "Total" con todas las cuotas sumadas |
| Sin datos para un mes | Mostrar $0, no omitir la columna |
| Cliente sin tipo_cliente | Agrupar en fila "Sin clasificar" |

---

## 11. Orden de implementación sugerido

### Paso 1 — Tipos y servicio backend
1. Crear `src/types/fin-proyeccion-cobranzas.ts`
2. Crear `src/services/ProyeccionCobranzasService.ts` con algoritmo base (sin filtros secundarios)
3. Test manual: curl a la API con parámetros básicos

### Paso 2 — API Route principal
4. Crear `src/app/api/fin/reportes/proyeccion-cobranzas/route.ts`
5. Validar con Zod, conectar al servicio
6. Verificar respuesta JSON correcta

### Paso 3 — Página base (tabla + KPIs)
7. Crear `src/app/(dashboard)/reportes/proyeccion-cobranzas/page.tsx`
8. Implementar `ProyeccionKpis` con cards
9. Implementar `ProyeccionTabla` con scroll horizontal y columna fija
10. Verificar render correcto con datos reales

### Paso 4 — Filtros
11. Implementar `ProyeccionFiltros` con selects dinámicos
12. Cargar opciones desde APIs existentes (`/api/fin/tipos-cliente`, `/api/fin/sucursales`, etc.)
13. Conectar filtros con re-fetch de la API

### Paso 5 — Gráfico
14. Implementar `ProyeccionGrafico` (barras mensuales)
15. Puede usar `recharts` si ya está en el proyecto, o chart nativo simple con SVG/CSS

### Paso 6 — Drill-down y exportación
16. Crear API de detalle
17. Implementar `ProyeccionDetalle` (drawer)
18. Implementar exportación Excel

### Paso 7 — Sidebar y pulido final
19. Agregar entrada en sidebar
20. Actualizar `SISTEMA_PRESTALOAPP.md` con el nuevo módulo

---

## 12. Dependencias a verificar antes de implementar

```bash
# Verificar si xlsx está instalado
npm list xlsx

# Si no: instalar
npm install xlsx
```

No se requieren otras dependencias nuevas. Todo el resto usa el stack existente.

---

## 13. Restricciones y límites de Firestore

| Restricción | Impacto | Solución |
|-------------|---------|---------|
| Max 500 docs por `getAll()` batch | Fetch de créditos/clientes por lotes | Batching de IDs en grupos de 500 |
| No existe `where in` + `range` en mismo campo | Dos queries separadas por estado | Ver sección 2.4 |
| No hay aggregación nativa en Firestore (Admin SDK v12) | No usar `.aggregate()` para esto | Aggregate en servicio Node |
| Indices compuestos requeridos | `estado + fecha_vencimiento` puede necesitar index | Crear en Firebase Console si la query falla |

**Index compuesto requerido en `fin_cuotas`:**
```
Collection: organizations/{orgId}/fin_cuotas
Fields: estado ASC, fecha_vencimiento ASC
```

---

## 14. Criterio de aceptación

El módulo estará completo cuando permita responder estas preguntas con datos reales:

- ✅ ¿Cuánto tengo pendiente de cobrar en cada mes futuro?
- ✅ ¿Cuánto espero cobrar de un cliente puntual en los próximos 12 meses?
- ✅ ¿Cuánto tengo vencido e impago acumulado?
- ✅ ¿Cuánto proyectan cobrar los clientes de tipo "Empresa A" el mes próximo?
- ✅ ¿Qué cartera futura tiene la sucursal Centro?
- ✅ ¿Cuánto representan los próximos 6 meses de cobro esperado sobre la cartera total?
- ✅ ¿Cuántas cuotas pendientes tiene el cliente X?

---

## 15. Estimación de archivos nuevos

| Archivo | Tipo |
|---------|------|
| `src/types/fin-proyeccion-cobranzas.ts` | Tipos TypeScript |
| `src/services/ProyeccionCobranzasService.ts` | Servicio backend |
| `src/app/api/fin/reportes/proyeccion-cobranzas/route.ts` | API Route GET |
| `src/app/api/fin/reportes/proyeccion-cobranzas/detalle/route.ts` | API Route drill-down |
| `src/app/(dashboard)/reportes/proyeccion-cobranzas/page.tsx` | Página principal |
| `src/components/fin-proyeccion/ProyeccionFiltros.tsx` | Componente filtros |
| `src/components/fin-proyeccion/ProyeccionKpis.tsx` | Componente KPIs |
| `src/components/fin-proyeccion/ProyeccionGrafico.tsx` | Componente gráfico |
| `src/components/fin-proyeccion/ProyeccionTabla.tsx` | Componente tabla matriz |
| `src/components/fin-proyeccion/ProyeccionDetalle.tsx` | Drawer drill-down |

**Archivos existentes a modificar:**
| Archivo | Cambio |
|---------|--------|
| Sidebar config | Agregar entrada "Proyección de cobranzas" |
| `reports/SISTEMA_PRESTALOAPP.md` | Agregar módulo nuevo |

---

*Referencia: prompt original del usuario — 2026-03-22*
