# Plan OLAS 11–14 — Cuenta Corriente Financiada Comercial

> **Fecha:** 2026-04-04
> **Módulo:** `CtaCteComercial`
> **UI nombre:** Cuenta Corriente Financiada
> **Estado:** OLA 11 ✅ completada — OLA 12 en curso
> **Prerequisito:** Olas 0–5 completadas (commit `df7f2b5`) · build OK · tsc 0 errores

---

## Resumen ejecutivo

Este módulo habilita una modalidad de venta financiada **sin cuotas rígidas**, donde el comercio
otorga mercadería al cliente y mantiene un saldo vivo que se reduce con entregas parciales de
dinero. Es un submódulo **completamente independiente** de `fin_creditos` y `fin_cuotas`.

| Ola | Contenido | Estado |
|-----|-----------|--------|
| 11  | Modelo de datos + alta + pagos parciales | ✅ COMPLETA — commit `962afee` (rama main) |
| 12  | Control mensual + mora + bandejas | 🔄 En curso |
| 13  | Contabilidad + reportes | ⏳ Pendiente |
| 14  | Políticas reutilizables + automatizaciones | ⏳ Pendiente |

### Entregables OLA 11 (verificados — tsc 0 errores)
- `src/types/fin-ctacte.ts` — tipos completos (incluye FinCtaCteControlMensual y FinCtaCtePolitica adelantados)
- `src/services/CtaCteService.ts` — crearOperacion, registrarPago, getOperaciones, getOperacion, getMovimientos
- `src/app/api/fin/ctacte/route.ts` — GET + POST con capability check
- `src/app/api/fin/ctacte/[id]/route.ts` — GET detalle
- `src/app/api/fin/ctacte/[id]/movimientos/route.ts` — GET historial
- `src/app/api/fin/ctacte/[id]/pagos/route.ts` — POST pago con validaciones
- `src/app/(dashboard)/cta-corriente/page.tsx` — listado con 5 bandejas + KPIs
- `src/app/(dashboard)/cta-corriente/nueva/page.tsx` — alta completa
- `src/app/(dashboard)/cta-corriente/[id]/page.tsx` — detalle + modal pago
- `src/lib/capabilities.ts` — CTA_CTE_COMERCIAL registrado como plugin
- `src/components/layout/Sidebar.tsx` — ítem gateado por capability

### Trabajo adicional realizado (fuera del plan CtaCte, mismo repo)
- Lenguaje visual unificado en `clientes/page.tsx`, `cobros/page.tsx`, `creditos/page.tsx`
- Módulo **Control de Mora** implementado: `MoraService.ts`, `fin-mora.ts`, `MoraCRMBoard.tsx`
- API routes: `GET /api/fin/control-mora/clientes`, `PATCH /api/fin/control-mora/clientes/[id]`, `GET/POST /api/fin/control-mora/acciones`
- Páginas: `acciones/mora-temprana/page.tsx` y `acciones/judiciales/page.tsx` migradas al nuevo circuito

---

## Análisis del código actual relevante

### Colecciones existentes (no modificar)

```
organizations/{orgId}/fin_creditos        ← créditos con cuotas fijas
organizations/{orgId}/fin_cuotas          ← cuotas pre-calculadas
organizations/{orgId}/fin_cobros          ← cobros vinculados a cuota_id
organizations/{orgId}/fin_asientos        ← asientos contables
organizations/{orgId}/fin_clientes        ← maestro de clientes (lectura)
organizations/{orgId}/fin_sucursales/.../fin_cajas  ← cajas (lectura)
```

### Servicios existentes — NO modificar, solo reutilizar

| Servicio | Qué se reutiliza |
|----------|-----------------|
| `JournalEntryService` | Patrón `buildLinea()` + `getPeriodo()` — NO extender, crear `CtaCteJournalService` paralelo |
| `LedgerService` | Escritura en `fin_ledger_entries` — reutilizar sin cambios |
| `ClienteService` | Lectura de clientes para validación — sin cambios |

### Patrones de seguridad — respetar exactamente

```typescript
// API route obligatoria
export const GET = withAuth(async (_req, _ctx, { organizationId }) => {
  const db = getAdminFirestore()
  // ...
})

// Scoping multi-tenant
const orgId = await resolveAuthorizedOrganizationId(organizationId)
```

### Zod v4 — reglas de validación

```typescript
// CORRECTO para campos numéricos de formulario
importe: z.number()   // + valueAsNumber: true en register()

// INCORRECTO — no usar en este proyecto
importe: z.coerce.number()   // ← NO
```

---

## OLA 11 — Core operativo: modelo, alta y pagos

> **Objetivo:** Un operador puede abrir una cuenta corriente, registrar entregas de dinero
> y ver el saldo actual en tiempo real.

### 11.1 Colecciones Firestore nuevas

Agregar en `src/firebase/collections.ts`:

```typescript
// --- Cuenta Corriente Financiada ---
ctaCteOperaciones: (orgId: string) =>
  `organizations/${orgId}/fin_ctacte_operaciones`,
ctaCteOperacion: (orgId: string, id: string) =>
  `organizations/${orgId}/fin_ctacte_operaciones/${id}`,

ctaCteMovimientos: (orgId: string) =>
  `organizations/${orgId}/fin_ctacte_movimientos`,
ctaCteMovimiento: (orgId: string, id: string) =>
  `organizations/${orgId}/fin_ctacte_movimientos/${id}`,
```

**Índices Firestore necesarios** (agregar en `firestore.indexes.json`):

```json
[
  {
    "collectionGroup": "fin_ctacte_operaciones",
    "fields": [
      { "fieldPath": "organization_id", "order": "ASCENDING" },
      { "fieldPath": "estado",          "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "fin_ctacte_operaciones",
    "fields": [
      { "fieldPath": "organization_id", "order": "ASCENDING" },
      { "fieldPath": "cliente_id",      "order": "ASCENDING" }
    ]
  },
  {
    "collectionGroup": "fin_ctacte_movimientos",
    "fields": [
      { "fieldPath": "operacion_id", "order": "ASCENDING" },
      { "fieldPath": "fecha",        "order": "ASCENDING" }
    ]
  }
]
```

### 11.2 Tipos TypeScript

**Archivo nuevo:** `src/types/fin-ctacte.ts`

```typescript
// ─── Reglas de la cuenta corriente ───────────────────────────────────────────

export type FinCtaCteEntregaMinimaT = 'monto_fijo' | 'pct_compra' | 'pct_saldo';
export type FinCtaCteCargoT         = 'monto_fijo' | 'pct_saldo';

export interface FinCtaCteReglas {
  /** Tipo de cálculo para la entrega mínima mensual exigida */
  entrega_minima_tipo:   FinCtaCteEntregaMinimaT;
  /** Valor para calcular la entrega mínima (importe fijo o porcentaje) */
  entrega_minima_valor:  number;
  /** Gasto fijo mensual a aplicar (0 = no aplica) */
  gasto_fijo_mensual:    number;
  /** Día del mes en que se realiza el control (1..28) */
  dia_control:           number;
  /** Días de gracia desde el dia_control antes de aplicar mora */
  gracia_dias:           number;
  /** Si aplicar mora cuando no hubo ningún pago en el período */
  aplica_mora_sin_pago:  boolean;
  /** Tipo de cálculo para la mora */
  mora_tipo:             FinCtaCteCargoT;
  /** Valor para calcular la mora */
  mora_valor:            number;
  /** Si la operación puede refinanciarse */
  permite_refinanciacion: boolean;
}

// ─── Operación principal ──────────────────────────────────────────────────────

export type FinCtaCteEstado =
  | 'activa'
  | 'al_dia'
  | 'incumplida'
  | 'sin_pago'
  | 'refinanciada'
  | 'cancelada'
  | 'judicial';

export interface FinCtaCteOperacion {
  id: string;
  organization_id: string;
  cliente_id: string;
  /** Snapshot del nombre para display sin join */
  cliente_nombre: string;
  sucursal_id?: string;

  // Datos de la venta de origen
  fecha_venta: string;          // YYYY-MM-DD
  comprobante: string;          // N° factura / remito
  detalle_mercaderia: string;
  monto_original: number;
  /** Saldo vivo actual — siempre recalculado por movimientos */
  saldo_actual: number;

  estado: FinCtaCteEstado;
  ultimo_pago_fecha?:      string;   // YYYY-MM-DD
  ultimo_control_periodo?: string;   // YYYY-MM

  /** Copia de reglas al momento de creación — inmutable salvo refinanciación */
  reglas: FinCtaCteReglas;

  /** Si viene de una refinanciación, id de la operación original */
  refinanciacion_origen_id?: string;

  createdAt: string;
  createdBy: string;
  updatedAt: string;
}

// ─── Movimientos ─────────────────────────────────────────────────────────────

export type FinCtaCteMovimientoTipo =
  | 'venta_inicial'     // alta de la operación
  | 'pago_cliente'      // entrega de dinero del cliente
  | 'gasto_fijo'        // cargo mensual fijo
  | 'mora'              // penalidad por falta de pago
  | 'ajuste_manual'     // corrección autorizada
  | 'refinanciacion'    // cierre por refinanciación
  | 'cancelacion';      // saldo llegó a cero o cancelación manual

export interface FinCtaCteMovimiento {
  id: string;
  organization_id: string;
  operacion_id: string;

  tipo:         FinCtaCteMovimientoTipo;
  fecha:        string;   // YYYY-MM-DD
  importe:      number;   // siempre positivo (el tipo indica dirección)
  /** Negativo = reduce saldo · Positivo = aumenta saldo */
  impacto_saldo: number;
  saldo_anterior: number;
  saldo_nuevo:    number;

  descripcion:  string;
  /** Para movimientos mensuales (mora, gasto_fijo): período YYYY-MM */
  periodo?:     string;

  // Vínculos opcionales
  asiento_id?:  string;
  caja_id?:     string;

  createdAt:  string;
  createdBy:  string;
}
```

### 11.3 Servicio `CtaCteService`

**Archivo nuevo:** `src/services/CtaCteService.ts`

```typescript
import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import type {
  FinCtaCteOperacion,
  FinCtaCteMovimiento,
  FinCtaCteMovimientoTipo,
} from '@/types/fin-ctacte';
import { FieldValue } from 'firebase-admin/firestore';

export class CtaCteService {

  /**
   * Crea la operación y el movimiento inicial 'venta_inicial'.
   * Devuelve el id de la operación creada.
   */
  static async crearOperacion(
    orgId: string,
    data: Omit<FinCtaCteOperacion, 'id' | 'saldo_actual' | 'estado' | 'createdAt' | 'updatedAt'>,
    usuarioId: string
  ): Promise<string> {
    const db = getAdminFirestore();
    const opRef = db.collection(FIN_COLLECTIONS.ctaCteOperaciones(orgId)).doc();

    const operacion: FinCtaCteOperacion = {
      ...data,
      id: opRef.id,
      saldo_actual: data.monto_original,
      estado: 'activa',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: usuarioId,
    };

    const movRef = db.collection(FIN_COLLECTIONS.ctaCteMovimientos(orgId)).doc();
    const movInicial: FinCtaCteMovimiento = {
      id:            movRef.id,
      organization_id: orgId,
      operacion_id:  opRef.id,
      tipo:          'venta_inicial',
      fecha:         data.fecha_venta,
      importe:       data.monto_original,
      impacto_saldo: data.monto_original, // positivo: establece el saldo
      saldo_anterior: 0,
      saldo_nuevo:   data.monto_original,
      descripcion:   `Apertura: ${data.comprobante}`,
      createdAt:     new Date().toISOString(),
      createdBy:     usuarioId,
    };

    await db.runTransaction(async (tx) => {
      tx.set(opRef, operacion);
      tx.set(movRef, movInicial);
    });

    return opRef.id;
  }

  /**
   * Registra una entrega de dinero del cliente.
   * Si el saldo resultante es <= 0 marca la operación como cancelada.
   */
  static async registrarPago(
    orgId: string,
    operacionId: string,
    importe: number,
    fecha: string,
    descripcion: string,
    cajaId: string | undefined,
    usuarioId: string
  ): Promise<void> {
    const db = getAdminFirestore();
    const opRef = db
      .collection(FIN_COLLECTIONS.ctaCteOperaciones(orgId))
      .doc(operacionId);

    await db.runTransaction(async (tx) => {
      const snap = await tx.get(opRef);
      if (!snap.exists) throw new Error(`Operación ${operacionId} no encontrada`);

      const op = snap.data() as FinCtaCteOperacion;
      const saldoAnterior = op.saldo_actual;
      const saldoNuevo    = Math.max(0, saldoAnterior - importe);
      const estadoNuevo: FinCtaCteOperacion['estado'] =
        saldoNuevo === 0 ? 'cancelada' : op.estado;

      const movRef = db.collection(FIN_COLLECTIONS.ctaCteMovimientos(orgId)).doc();
      const mov: FinCtaCteMovimiento = {
        id:             movRef.id,
        organization_id: orgId,
        operacion_id:   operacionId,
        tipo:           'pago_cliente',
        fecha,
        importe,
        impacto_saldo:  -importe,
        saldo_anterior: saldoAnterior,
        saldo_nuevo:    saldoNuevo,
        descripcion,
        caja_id:        cajaId,
        createdAt:      new Date().toISOString(),
        createdBy:      usuarioId,
      };

      tx.set(movRef, mov);
      tx.update(opRef, {
        saldo_actual:     saldoNuevo,
        ultimo_pago_fecha: fecha,
        estado:           estadoNuevo,
        updatedAt:        new Date().toISOString(),
      });
    });
  }

  /** Devuelve los movimientos de una operación ordenados por fecha asc */
  static async getMovimientos(
    orgId: string,
    operacionId: string
  ): Promise<FinCtaCteMovimiento[]> {
    const db = getAdminFirestore();
    const snap = await db
      .collection(FIN_COLLECTIONS.ctaCteMovimientos(orgId))
      .where('operacion_id', '==', operacionId)
      .orderBy('fecha', 'asc')
      .get();
    return snap.docs.map((d) => d.data() as FinCtaCteMovimiento);
  }
}
```

### 11.4 API Routes

**`src/app/api/fin/ctacte/route.ts`** — listado y alta

```typescript
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { getAdminFirestore } from '@/firebase/admin';
import { FIN_COLLECTIONS } from '@/firebase/collections';
import { CtaCteService } from '@/services/CtaCteService';
import { z } from 'zod';
import type { FinCtaCteOperacion } from '@/types/fin-ctacte';

export const dynamic = 'force-dynamic';

// ─── Esquema de validación (Zod v4) ──────────────────────────────────────────
const NuevaOperacionSchema = z.object({
  cliente_id:          z.string().min(1),
  cliente_nombre:      z.string().min(1),
  sucursal_id:         z.string().optional(),
  fecha_venta:         z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  comprobante:         z.string().min(1),
  detalle_mercaderia:  z.string().min(1),
  monto_original:      z.number().positive(),
  reglas: z.object({
    entrega_minima_tipo:    z.enum(['monto_fijo', 'pct_compra', 'pct_saldo']),
    entrega_minima_valor:   z.number().min(0),
    gasto_fijo_mensual:     z.number().min(0),
    dia_control:            z.number().int().min(1).max(28),
    gracia_dias:            z.number().int().min(0),
    aplica_mora_sin_pago:   z.boolean(),
    mora_tipo:              z.enum(['monto_fijo', 'pct_saldo']),
    mora_valor:             z.number().min(0),
    permite_refinanciacion: z.boolean(),
  }),
});

export const GET = withAuth(async (_req, _ctx, { organizationId }) => {
  const db = getAdminFirestore();
  const snap = await db
    .collection(FIN_COLLECTIONS.ctaCteOperaciones(organizationId))
    .where('estado', '!=', 'cancelada')
    .orderBy('estado')
    .orderBy('createdAt', 'desc')
    .get();
  const operaciones = snap.docs.map((d) => d.data() as FinCtaCteOperacion);
  return NextResponse.json({ operaciones });
});

export const POST = withAuth(async (req, _ctx, { organizationId, user }) => {
  const body = await req.json();
  const parsed = NuevaOperacionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const id = await CtaCteService.crearOperacion(
    organizationId,
    { ...parsed.data, organization_id: organizationId },
    user.uid
  );
  return NextResponse.json({ id }, { status: 201 });
});
```

**`src/app/api/fin/ctacte/[id]/pagos/route.ts`** — registrar pago

```typescript
import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/withAuth';
import { CtaCteService } from '@/services/CtaCteService';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PagoSchema = z.object({
  importe:     z.number().positive(),
  fecha:       z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  descripcion: z.string().min(1),
  caja_id:     z.string().optional(),
});

export const POST = withAuth(async (req, ctx, { organizationId, user }) => {
  const { id } = await ctx.params;
  const body   = await req.json();
  const parsed = PagoSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  await CtaCteService.registrarPago(
    organizationId,
    id,
    parsed.data.importe,
    parsed.data.fecha,
    parsed.data.descripcion,
    parsed.data.caja_id,
    user.uid
  );

  return NextResponse.json({ ok: true });
});
```

### 11.5 Páginas UI

**Archivos nuevos:**

```
src/app/(dashboard)/cta-corriente/page.tsx        ← listado
src/app/(dashboard)/cta-corriente/nueva/page.tsx  ← alta
src/app/(dashboard)/cta-corriente/[id]/page.tsx   ← detalle + acciones
```

**Listado — estructura básica:**

```tsx
// src/app/(dashboard)/cta-corriente/page.tsx
'use client'

import { useState, useEffect } from 'react'
import apiFetch from '@/lib/apiFetch'
import type { FinCtaCteOperacion } from '@/types/fin-ctacte'

// Tabs: 'activas' | 'al_dia' | 'sin_pago' | 'incumplidas'
// Tabla: Cliente | Saldo actual | Último pago | Estado | Acciones
// Botón "Nueva cuenta corriente" → /cta-corriente/nueva
```

**Sidebar** — agregar en `src/components/layout/Sidebar.tsx`:

```tsx
// Dentro de la sección "Operaciones"
{
  label: 'Cta. Cte. Financiada',
  href:  '/cta-corriente',
  icon:  Wallet,   // lucide-react
}
```

### 11.6 Criterios de aceptación OLA 11

- [ ] Se puede crear una operación desde la UI
- [ ] El saldo inicial = `monto_original`
- [ ] Se puede registrar un pago desde el detalle
- [ ] El saldo se reduce correctamente tras el pago
- [ ] Si el saldo llega a 0, el estado pasa a `cancelada`
- [ ] El historial de movimientos muestra `venta_inicial` + `pago_cliente`
- [ ] `tsc --noEmit` sin errores
- [ ] Build Vercel verde

---

## OLA 12 — Control mensual, mora y bandejas operativas

> **Objetivo:** El sistema detecta automáticamente incumplimientos mensuales,
> aplica mora y organiza la cartera en bandejas de gestión.

### 12.1 Colección nueva

Agregar en `src/firebase/collections.ts`:

```typescript
ctaCteControlMensual: (orgId: string) =>
  `organizations/${orgId}/fin_ctacte_control_mensual`,
ctaCteControlDoc: (orgId: string, id: string) =>
  `organizations/${orgId}/fin_ctacte_control_mensual/${id}`,
```

### 12.2 Tipo TypeScript

Agregar en `src/types/fin-ctacte.ts`:

```typescript
export interface FinCtaCteControlMensual {
  id: string;
  organization_id: string;
  operacion_id: string;
  /** Período controlado en formato YYYY-MM */
  periodo: string;

  total_pagado:              number;
  entrega_minima_esperada:   number;
  cumple_minimo:             boolean;
  hubo_pago:                 boolean;

  mora_aplicada:             number;
  gasto_fijo_aplicado:       number;

  estado_resultante:         FinCtaCteEstado;
  procesado_en:              string;   // ISO datetime
  procesado_por:             string;
}
```

### 12.3 Servicio `CtaCteControlMensualService`

**Archivo nuevo:** `src/services/CtaCteControlMensualService.ts`

Lógica principal:

```typescript
/**
 * Ejecuta el cierre de período para una operación.
 * - Calcula lo pagado en el período
 * - Determina si cumplió el mínimo
 * - Aplica mora si corresponde (idempotente)
 * - Aplica gasto fijo si corresponde (idempotente)
 * - Actualiza el estado de la operación
 * - Graba el registro de control mensual
 */
static async ejecutarControlPeriodo(
  orgId: string,
  operacionId: string,
  periodo: string,   // 'YYYY-MM'
  usuarioId: string
): Promise<FinCtaCteControlMensual>
```

**Reglas de idempotencia obligatorias:**

```typescript
// Antes de aplicar mora o gasto fijo del período, verificar que no exista ya
const existente = await db
  .collection(FIN_COLLECTIONS.ctaCteControlMensual(orgId))
  .where('operacion_id', '==', operacionId)
  .where('periodo', '==', periodo)
  .limit(1)
  .get();

if (!existente.empty) {
  throw new Error(`Control del período ${periodo} ya fue ejecutado`);
}
```

**Cálculo de entrega mínima esperada:**

```typescript
function calcularEntregaMinima(
  reglas: FinCtaCteReglas,
  montoOriginal: number,
  saldoActual: number
): number {
  switch (reglas.entrega_minima_tipo) {
    case 'monto_fijo':  return reglas.entrega_minima_valor;
    case 'pct_compra':  return montoOriginal * (reglas.entrega_minima_valor / 100);
    case 'pct_saldo':   return saldoActual   * (reglas.entrega_minima_valor / 100);
  }
}
```

### 12.4 API — endpoint de control

**`src/app/api/fin/ctacte/[id]/control/route.ts`**

```typescript
// POST → ejecutar control del período indicado
// Body: { periodo: 'YYYY-MM' }
// Responde con el FinCtaCteControlMensual generado
```

### 12.5 Bandejas operativas en el listado

```
/cta-corriente

Tabs:
  [Al día]               estado === 'al_dia'
  [Sin pago este mes]    estado === 'sin_pago'
  [Entrega insuficiente] estado === 'incumplida'
  [Judiciales]           estado === 'judicial'
  [Todas activas]        estado !== 'cancelada' && estado !== 'refinanciada'
```

### 12.6 Panel de control mensual masivo

Pantalla en `/cta-corriente/control-mensual`:

```
Período: [YYYY-MM] [Ejecutar control para todas las operaciones activas]

Resultado:
  Procesadas: 34
  Al día:     22
  Incumplidas: 8
  Sin pago:    4
```

### 12.7 Criterios de aceptación OLA 12

- [ ] El control mensual detecta correctamente quién pagó y quién no
- [ ] La mora se aplica una sola vez por período (idempotente)
- [ ] El gasto fijo se aplica una sola vez por período (idempotente)
- [ ] El estado de la operación se actualiza después del control
- [ ] Las 4 bandejas muestran las operaciones correctas
- [ ] `tsc --noEmit` sin errores · build verde

---

## OLA 13 — Integración contable y reportes

> **Objetivo:** Cada movimiento genera su asiento automático.
> Un reporte muestra la cartera activa con saldos y atrasos.

### 13.1 Config contable

En `fin_config_cuentas/ctacte` (mismo patrón que plugin existente):

```typescript
// Interfaz para src/types/fin-plan-cuentas.ts (extender o archivo propio)
interface FinConfigCtaCte {
  cuentas: {
    creditos_ctacte:      string;   // cuenta_id — activo corriente
    ventas_ctacte:        string;   // cuenta_id — ingresos
    ingresos_mora_ctacte: string;   // cuenta_id — ingresos financieros
    ingresos_gastos_adm:  string;   // cuenta_id — ingresos por gastos admin
    caja_default:         string;   // cuenta_id — fallback si no se elige caja
  }
}
```

### 13.2 Servicio `CtaCteJournalService`

**Archivo nuevo:** `src/services/CtaCteJournalService.ts`

Asientos por evento:

| Evento | Debe | Haber |
|--------|------|-------|
| `venta_inicial` | Créditos por cta cte | Ventas financiadas |
| `pago_cliente` | Caja / Bancos | Créditos por cta cte |
| `mora` | Créditos por cta cte | Ingresos por mora |
| `gasto_fijo` | Créditos por cta cte | Ingresos gastos adm |
| `cancelacion` | *(ya imputado en pagos)* | — |

**Comportamiento sin config:** si `fin_config_cuentas/ctacte` no existe,
el movimiento se guarda igual y el campo `asiento_id` queda vacío.
Mismo comportamiento que `JournalEntryService` en el core.

### 13.3 Integración en `CtaCteService` y `CtaCteControlMensualService`

Tras crear cada movimiento, llamar a `CtaCteJournalService.generarAsiento(...)` dentro de la misma transacción Firestore cuando la config contable esté disponible.

### 13.4 Reporte de cartera activa

**Ruta:** `src/app/(dashboard)/reportes/cartera-ctacte/page.tsx`
**API:** `GET /api/fin/reportes/cartera-ctacte`

Columnas del reporte:

```
Cliente | Fecha apertura | Comprobante | Monto original | Saldo actual | Estado | Días desde último pago
```

Agrupadores disponibles:
- Sin agrupación
- Por estado
- Por sucursal

Exportación a Excel con `xlsx` (misma librería ya instalada).

### 13.5 Pantalla de configuración contable

Agregar sección "Cuenta Corriente" en `/configuracion/plan-cuentas` (o tab nuevo):

```
Cuenta Créditos Cta Cte:      [selector de cuenta]
Cuenta Ventas Cta Cte:        [selector de cuenta]
Cuenta Ingresos Mora:         [selector de cuenta]
Cuenta Ingresos Gastos Adm:   [selector de cuenta]
[Guardar configuración]
```

### 13.6 Criterios de aceptación OLA 13

- [ ] Al crear una operación se genera el asiento de alta
- [ ] Al registrar un pago se genera el asiento de cobro
- [ ] Al aplicar mora se genera el asiento correspondiente
- [ ] Si no hay config contable, el flujo no falla — solo omite el asiento
- [ ] El reporte de cartera muestra los saldos correctos
- [ ] La exportación Excel funciona
- [ ] `tsc --noEmit` sin errores · build verde

---

## OLA 14 — Políticas reutilizables y automatizaciones

> **Objetivo:** Las organizaciones configuran plantillas de condiciones.
> El control mensual puede ejecutarse automáticamente.

### 14.1 Colección `fin_ctacte_politicas`

Agregar en `src/firebase/collections.ts`:

```typescript
ctaCtePoliticas: (orgId: string) =>
  `organizations/${orgId}/fin_ctacte_politicas`,
ctaCtePolitica: (orgId: string, id: string) =>
  `organizations/${orgId}/fin_ctacte_politicas/${id}`,
```

Tipo TypeScript:

```typescript
export interface FinCtaCtePolitica {
  id: string;
  organization_id: string;
  nombre: string;
  descripcion?: string;
  activa: boolean;
  /** Reglas predeterminadas para las operaciones que usen esta política */
  reglas: FinCtaCteReglas;
  createdAt: string;
  createdBy: string;
}
```

### 14.2 Uso de política en el formulario de alta

Al seleccionar una política en `/cta-corriente/nueva`:
- Pre-carga las reglas del formulario
- El operador puede modificar antes de guardar
- Se guarda la copia inline de reglas en la operación (no referencia) — así los cambios futuros a la política no afectan operaciones históricas

### 14.3 Automatización del control mensual

**Opción A — Cron job Vercel (recomendada):**

```
src/app/api/cron/ctacte-control/route.ts
```

```typescript
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/ctacte-control",
      "schedule": "0 8 10 * *"   // día 10 de cada mes a las 8:00
    }
  ]
}
```

El cron itera todas las organizaciones activas y ejecuta el control del período anterior para cada operación en estado activo.

**Opción B — Trigger manual desde UI** (implementar en OLA 12, mantener para OLA 14)

### 14.4 Alertas (futuro)

Cuando el control mensual detecta `sin_pago` o `incumplida`:
- Crear entrada en `fin_ctacte_alertas` (nueva colección pequeña)
- Campos: `operacion_id`, `tipo_alerta`, `periodo`, `enviada_whatsapp`
- Integrar con el skill de WhatsApp/notificaciones cuando esté disponible

### 14.5 Ruta de gestión de políticas

```
/configuracion/ctacte-politicas
  → listado de políticas activas
  → crear / editar política
  → desactivar (no borrar)
```

### 14.6 Criterios de aceptación OLA 14

- [ ] ABM de políticas funciona correctamente
- [ ] Al crear operación se puede elegir una política y pre-cargar reglas
- [ ] El cron job ejecuta el control mensual automáticamente
- [ ] El log del cron muestra las organizaciones procesadas y los resultados
- [ ] `tsc --noEmit` sin errores · build verde

---

## Resumen de archivos nuevos por ola

### OLA 11
```
src/types/fin-ctacte.ts
src/services/CtaCteService.ts
src/app/api/fin/ctacte/route.ts
src/app/api/fin/ctacte/[id]/route.ts
src/app/api/fin/ctacte/[id]/pagos/route.ts
src/app/api/fin/ctacte/[id]/movimientos/route.ts
src/app/(dashboard)/cta-corriente/page.tsx
src/app/(dashboard)/cta-corriente/nueva/page.tsx
src/app/(dashboard)/cta-corriente/[id]/page.tsx
```

### OLA 12
```
src/services/CtaCteControlMensualService.ts
src/app/api/fin/ctacte/[id]/control/route.ts
src/app/api/fin/ctacte/control-masivo/route.ts
src/app/(dashboard)/cta-corriente/control-mensual/page.tsx
```

### OLA 13
```
src/services/CtaCteJournalService.ts
src/app/api/fin/reportes/cartera-ctacte/route.ts
src/app/(dashboard)/reportes/cartera-ctacte/page.tsx
```

### OLA 14
```
src/services/CtaCtePoliticaService.ts
src/app/api/fin/ctacte-politicas/route.ts
src/app/api/fin/ctacte-politicas/[id]/route.ts
src/app/api/cron/ctacte-control/route.ts
src/app/(dashboard)/configuracion/ctacte-politicas/page.tsx
vercel.json  (agregar cron)
```

### Archivos modificados
```
src/firebase/collections.ts              ← 4 grupos de rutas nuevas
src/components/layout/Sidebar.tsx        ← item Cta. Cte. Financiada
firestore.indexes.json                   ← 3 índices compuestos nuevos
```

---

## Reglas transversales a respetar en todas las olas

1. **`withAuth` en cada API route** — sin excepción
2. **`resolveAuthorizedOrganizationId`** — siempre antes de queries Firestore
3. **Zod v4** — `z.number()` + `valueAsNumber: true`, nunca `z.coerce.number()`
4. **Transacciones Firestore** — toda operación que toca 2+ documentos va en `runTransaction`
5. **Sin `useState` global** — solo `useState` + `useEffect` + `apiFetch` en UI
6. **Prefijo `fin_`** en todas las colecciones nuevas
7. **Snapshots de datos de cliente** — guardar `cliente_nombre` en la operación para no hacer joins en listados
8. **No modificar** `CreditoService`, `AmortizationService`, `CobroService`, `JournalEntryService`

---

## INTEGRACIÓN PLUGIN — Cuenta Corriente Financiada como Capability

### Qué ya está hecho

- `src/lib/capabilities.ts` — constante `CTA_CTE_COMERCIAL = 'cta_cte_comercial'` y entrada en `PLUGIN_CAPABILITIES` con label "Cuenta Corriente Financiada" y descripción completa. ✅

### Lo que resta — 3 touchpoints mínimos

#### 1. Sidebar (`src/components/layout/Sidebar.tsx`)

- Importar `useAuth` desde `@/hooks/useAuth` y `CAPABILITIES` desde `@/lib/capabilities`.
- Mostrar el ítem "Cta. Cte. Financiada" solo si `capabilities.includes(CAPABILITIES.CTA_CTE_COMERCIAL)`.
- Patrón igual al que usa `CAPABILITIES.PRODUCTOS` en el mismo archivo.

```tsx
// Ejemplo de patrón a replicar
const { capabilities } = useAuth()

// En la definición de items del sidebar:
...(capabilities.includes(CAPABILITIES.CTA_CTE_COMERCIAL)
  ? [{ label: 'Cta. Cte. Financiada', href: '/cta-corriente', icon: Wallet }]
  : []),
```

#### 2. Páginas UI — cada página del módulo (`/cta-corriente/*`)

Al inicio de cada componente protegido:

```tsx
import { useAuth } from '@/hooks/useAuth'
import { CAPABILITIES } from '@/lib/capabilities'
import { redirect } from 'next/navigation'

// Dentro del componente:
const { capabilities } = useAuth()

if (!capabilities.includes(CAPABILITIES.CTA_CTE_COMERCIAL)) {
  redirect('/dashboard')
}
```

Afecta a los tres archivos de OLA 11:
- `src/app/(dashboard)/cta-corriente/page.tsx`
- `src/app/(dashboard)/cta-corriente/nueva/page.tsx`
- `src/app/(dashboard)/cta-corriente/[id]/page.tsx`

Patrón igual al usado en otras páginas protegidas del proyecto.

#### 3. API routes — cada route del módulo (`/api/fin/ctacte/*`)

`withAuth` ya garantiza autenticación. Para protección de capability a nivel de API, verificar que el documento `organizations/{orgId}` tenga la capability activa:

```typescript
// Patrón para API routes del módulo
export const GET = withAuth(async (_req, _ctx, { organizationId }) => {
  const db = getAdminFirestore()

  // Verificar capability activa en la organización
  const orgSnap = await db.doc(`organizations/${organizationId}`).get()
  const orgData = orgSnap.data()
  if (!orgData?.capabilities?.includes('cta_cte_comercial')) {
    return NextResponse.json({ error: 'Plugin no habilitado' }, { status: 403 })
  }

  // ... resto de la lógica
})
```

Afecta a todas las routes de OLA 11–14 bajo `/api/fin/ctacte/*` y `/api/fin/ctacte-politicas/*`.

---

### Por qué el impacto es mínimo

- Toda la infraestructura ya existe: JWT claims con capabilities, página de plugins en `/configuracion/plugins`, gestión desde super-admin, API de capabilities y el hook `useAuth` que ya expone `capabilities` al cliente.
- Solo se necesita consumir `capabilities.includes(...)` en 3 lugares: sidebar, páginas UI y API routes.
- Servicios y tipos (`CtaCteService`, `fin-ctacte.ts`, etc.) son agnósticos al plugin — no requieren ningún cambio.
- La activación la realiza el super-admin desde `/super-admin/organizaciones/[orgId]` usando la UI existente.

---

### Activación en super-admin

La entrada ya aparece automáticamente en la pantalla de gestión de plugins porque fue agregada al array `PLUGIN_CAPABILITIES` en `src/lib/capabilities.ts`. No requiere código adicional en super-admin.
