# Plan 62 — Venta Financiada (Plugin) + Cliente 360
**Fecha:** 2026-03-23
**Estado:** Pendiente de implementación

---

## Contexto

Dos iniciativas separadas pero relacionadas:

1. **Venta Financiada** — Sección propia dentro de Operaciones, gateada por el plugin `productos`.
   Listado diferenciado de créditos con tipo `compra_financiada`, con columnas y acciones propias del contexto comercial.

2. **Cliente 360** — Ampliar la ficha de cliente (`/clientes/[id]`) para que sea el registro completo de toda la relación con el cliente: préstamos, cheques, ventas financiadas, documentación adjunta y análisis de riesgo.

---

## Parte A — Venta Financiada (Plugin `productos`)

### A.1 Concepto

El plugin `productos` habilita:
- Lista separada de **ventas financiadas** dentro de Operaciones
- ABM de productos (tabla de artículos con precio de lista)
- Tasas diferenciadas por segmento para compra financiada _(fase 2)_

Por ahora (fase 1) alcanza con:
- Nueva ruta `/ventas-financiadas` que lista créditos con `tipo_operacion = 'compra_financiada'` (o `articulo_descripcion != 'Préstamo personal'` como heurística provisional)
- Columnas adaptadas: Artículo, Valor contado, Capital financiado, Cuotas, Estado

### A.2 Sidebar — cambio requerido

En `src/components/layout/Sidebar.tsx`, dentro de la sección colapsable **Operaciones**:

```
Operaciones
├── Prestamos          → /creditos         (siempre visible)
├── Cheques            → /operaciones-cheques (siempre)
└── Venta Financiada   → /ventas-financiadas  (solo si capability 'productos')
```

El item Venta Financiada usa el icono `ShoppingBag` (ya en lucide-react).

### A.3 Ruta y API

**Página:** `src/app/(dashboard)/ventas-financiadas/page.tsx`
- Misma estructura que `/creditos/page.tsx`
- Filtro: `tipo_operacion === 'compra_financiada'` OR heurística por `articulo_descripcion`
- Columnas específicas: `Artículo`, `Valor contado`, `Capital`, `Cuotas`, `Estado`, `Cliente`, `Fecha`
- Botón "Nueva venta" abre `NuevoCreditoDialog` pre-seteado en tipo `compra_financiada`

**API:** Reutilizar `/api/fin/creditos` con un query param `tipo=compra_financiada` (o filtrar en cliente).
No se requiere una API nueva — el servicio existente alcanza.

### A.4 Modelo de datos — campo a agregar en `FinCredito`

Actualmente existe `tipo_operacion?: FinPoliticaTipoOperacion` en el tipo.
Al crear un crédito de tipo `compra_financiada` se debe persistir:
- `tipo_operacion: 'compra_financiada'`
- `valor_contado_bien?: number` — campo nuevo opcional
- `articulo_descripcion` — ya existe ✅

**Cambios de código mínimos:**
1. Agregar `valor_contado_bien?: number` a `FinCredito` en `src/types/fin-credito.ts`
2. En `NuevoCreditoDialog`, incluir `valor_contado_bien` en el payload cuando `tipo === 'compra_financiada'`
3. En la API de creditos (`POST /api/fin/creditos`), guardar `tipo_operacion` y `valor_contado_bien`

### A.5 ABM de Productos (fase 2 — no implementar ahora)

Cuando el plugin `productos` esté maduro:
- Colección Firestore: `organizations/{orgId}/fin_productos`
- Campos: `id`, `nombre`, `codigo`, `precio_lista`, `categoria`, `activo`
- Ruta: `/configuracion/productos`
- Al seleccionar producto en el formulario → auto-completa `articulo_descripcion` y `valor_contado_bien`
- Tasas especiales por segmento × categoría de producto

---

## Parte B — Cliente 360

### B.1 Concepto

La ficha del cliente (`/clientes/[id]`) debe convertirse en el **expediente digital completo** del cliente dentro de la organización:

```
[Header: Nombre, CUIT, Tier, Cupo disponible]
[Tabs]
  ├── Resumen          (ya existe, mejorar)
  ├── Préstamos        (ya existe, ampliar)
  ├── Cheques          (ya existe)
  ├── Venta Financiada (nuevo, visible solo con plugin 'productos')
  ├── Legajo / Docs    (existe parcial, ampliar con adjuntos)
  └── Análisis de Riesgo (nuevo)
```

### B.2 Tab: Resumen (mejoras)

Estado actual: muestra resumen crediticio + evaluación + nosis + créditos.

**Mejoras propuestas:**
- KPI cards compactos en la parte superior: _Saldo total_, _Créditos activos_, _Cuotas vencidas_, _Próximo vencimiento_
- Timeline de eventos recientes (últimos cobros, otorgamientos, consultas Nosis) — ordenada por fecha desc
- Semáforo de riesgo visual (verde/amarillo/rojo según tier + mora)

### B.3 Tab: Préstamos (ampliar)

Estado actual: tabla básica con número, capital, sistema, cuotas, estado, fecha.

**Ampliar con:**
- Columna `Artículo/Destino`
- Columna `Cuotas pagas / Total` (ej. "3 / 12")
- Columna `Saldo capital`
- Filtro por estado (activo, cancelado, en mora)
- Click en fila → navega a `/creditos/[id]`
- Acción rápida: botón "Imprimir Pagaré" por fila

### B.4 Tab: Venta Financiada (nuevo, gateado por `productos`)

Misma tabla que la lista general de ventas financiadas, pero filtrada por cliente.
Columnas: `Artículo`, `Valor contado`, `Capital`, `Cuotas`, `Estado`, `Fecha`.

Solo visible cuando el org tiene capability `productos`.

### B.5 Tab: Cheques (ampliar)

Estado actual: tabla de operaciones de cheques.

**Ampliar con:**
- Detalle de cheques individuales dentro de cada operación (expandible)
- Estado de cada cheque (pendiente / cobrado / rechazado)
- Total operado en el período (filtro por rango de fechas)

### B.6 Tab: Legajo / Documentación

Estado actual: muestra porcentaje de completitud del legajo.

**Ampliar con:**
- Lista de documentos requeridos según política del segmento (DNI, recibo sueldo, etc.)
- Estado por documento: ✅ Cargado / ⚠ Faltante / ❌ Vencido
- **Adjuntos digitales**: upload de PDF/imagen por documento
  - Storage: Firebase Storage en `organizations/{orgId}/legajos/{clienteId}/{documento}.pdf`
  - Nuevo campo en `fin_clientes`: `legajo.documentos[]` con `{tipo, url, uploaded_at, uploaded_by, vence_at?}`
- Botón "Descargar todo" → ZIP con todos los adjuntos

### B.7 Tab: Análisis de Riesgo (nuevo)

Consolidar toda la información de scoring y riesgo en un panel dedicado:

**Secciones:**

#### Scoring actual
- Score final, score Nosis, tier asignado, tier sugerido
- Fecha de vigencia y expiración
- Motivos de rechazo o advertencias
- Límites aprobados: mensual, total, por operación

#### Historial de evaluaciones
- Tabla cronológica de todas las evaluaciones realizadas
- Columnas: Fecha, Score, Tier, Estado (aprobada/rechazada/expirada), Operador

#### Historial Nosis
- Lista de consultas realizadas (fecha, tipo de consulta, resultado resumido)
- Botón "Consultar ahora" → llama al endpoint de consulta Nosis

#### Indicadores de comportamiento de pago
- Cuotas pagas en término vs. tardías (porcentaje)
- Días promedio de atraso
- Monto total operado histórico
- Cantidad de créditos cancelados / activos / en mora

---

## Archivos a crear / modificar

### Parte A — Venta Financiada

| Archivo | Acción |
|---------|--------|
| `src/types/fin-credito.ts` | Agregar `valor_contado_bien?: number` |
| `src/components/layout/Sidebar.tsx` | Agregar item Venta Financiada gateado por `productos` |
| `src/app/(dashboard)/ventas-financiadas/page.tsx` | Crear — lista filtrada por `tipo_operacion` |
| `src/components/fin/dialogs/NuevoCreditoDialog.tsx` | Enviar `tipo_operacion` y `valor_contado_bien` en payload |
| `src/app/api/fin/creditos/route.ts` | Persistir nuevos campos + soportar query param `tipo` |

### Parte B — Cliente 360

| Archivo | Acción |
|---------|--------|
| `src/app/(dashboard)/clientes/[id]/page.tsx` | Reestructurar tabs + agregar tabs nuevas |
| `src/app/api/fin/clientes/[id]/route.ts` | Asegurar que devuelva datos completos |
| `src/app/api/fin/clientes/[id]/legajo/route.ts` | Nuevo — upload/list de adjuntos |
| `src/app/api/fin/clientes/[id]/riesgo/route.ts` | Nuevo — consolidar scoring + comportamiento pago |
| `src/types/fin-cliente.ts` | Agregar `legajo.documentos[]` |
| `src/components/fin/clientes/TabPrestamos.tsx` | Nuevo componente extraído |
| `src/components/fin/clientes/TabCheques.tsx` | Nuevo componente extraído |
| `src/components/fin/clientes/TabVentaFinanciada.tsx` | Nuevo — gateado por `productos` |
| `src/components/fin/clientes/TabLegajo.tsx` | Nuevo — reemplaza legajo actual |
| `src/components/fin/clientes/TabAnalisisRiesgo.tsx` | Nuevo |

---

## Orden de implementación recomendado

### Ola A — Venta Financiada (2-3 hs)
1. Agregar `valor_contado_bien` al tipo y al payload del form
2. Agregar item en sidebar (gateado)
3. Crear página `/ventas-financiadas` con lista filtrada

### Ola B — Cliente 360 base (3-4 hs)
1. Reestructurar tabs de `/clientes/[id]` extrayendo componentes
2. Mejorar tab Préstamos y Cheques
3. Crear tab Venta Financiada (gateada)

### Ola C — Análisis de Riesgo (2-3 hs)
1. API consolidadora `/clientes/[id]/riesgo`
2. Tab Análisis de Riesgo con scoring + historial + comportamiento pago

### Ola D — Legajo Digital con adjuntos (3-4 hs)
1. Firebase Storage integration
2. Upload/download de documentos
3. Estados de documentos por política de segmento

---

## Notas de diseño

- **Consistencia visual**: usar el patrón de tabs ya establecido en la ficha actual (Radix Tabs o similar)
- **Lazy loading por tab**: cada tab carga sus datos solo cuando se activa (evitar fetch de todo en mount)
- **Plugin gate**: `TabVentaFinanciada` se monta solo si `capabilities.includes('productos')` — no renderizar ni hacer fetch si no tiene el plugin
- **Mobile**: tabs colapsadas en select/dropdown en pantallas `< lg`
- **Adjuntos**: el upload de documentos puede ser fase D independiente; no bloquea las otras olas
