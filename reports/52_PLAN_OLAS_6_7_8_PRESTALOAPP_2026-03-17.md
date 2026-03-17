# Plan 52 — prestaloapp: Olas 6, 7 y 8

**Fecha:** 2026-03-17
**Feature:** Continuación post-Ola5 — Landing fix + Cajas + Seed + Scoring crediticio + Ledger + Reporting
**Proyecto:** `prestaloapp` — `c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp`
**Olas anteriores completadas:** 0–5 (Plan 51) + Extra contabilidad (commit 1295051)
**Build actual:** ✅ Verde en Vercel

---

## Contexto del estado actual

### Lo que YA existe (olas 0-5 + extra)
- Shell + Sidebar + Topbar + AuthGuard
- CRUD completo: Clientes, Créditos, Cobros, Plan de cuentas, Asientos
- Dashboard con KPIs reales (`/api/fin/dashboard`)
- Libro diario, Mayor, Cuenta corriente
- Landing page en `/` con brand tokens (globals.css configurado)
- Cajas: solo `page.tsx` de lista — **sin nuevo ni [id]**

### Problemas pendientes
1. `body` en `globals.css` usa `--font-geist-sans` (antiguo) en lugar de `--font-inter`
2. Landing usa imagen externa `i.pravatar.cc` — `next.config.ts` sin `images.remotePatterns`
3. Cajas incompleto — falta apertura/cierre con API
4. Sin datos demo en Firestore — dashboard muestra `—`
5. Sin scoring crediticio — evaluaciones manuales
6. Sin `customer_ledger_entries` — cuenta corriente por cliente sin subledger
7. Sin reporting P&L ni aging de cartera

---

## Reglas de renderización (heredadas del Plan 51 — OBLIGATORIAS)

- `'use client'` si usa hooks, eventos, Firebase Client SDK
- Server Components: solo firebase-admin, sin hooks
- Providers en archivo separado
- Admin SDK → solo en API routes
- Client SDK → solo en `'use client'`

---

## Stack del proyecto

```
Next.js 14.2.18 + TypeScript strict + React 18
Firebase 12.4 (Firestore client) + firebase-admin 13.5
Tailwind v4 (globals.css con @theme inline)
Radix UI + shadcn components en src/components/ui/
Zod + React Hook Form
apiFetch en src/lib/apiFetch.ts (Bearer token automático)
withAuth en src/lib/api/withAuth.ts
colecciones: src/firebase/collections.ts (prefijo fin_)
tipos: src/types/fin-*.ts
servicios: src/services/*.ts (Admin SDK)
```

---

## Resumen de olas

| Ola | Agentes | Paralelos entre sí | Dependen de |
|-----|---------|-------------------|-------------|
| 6 | 6A, 6B, 6C | Sí | Nada (todos independientes) |
| 7 | 7A, 7B | Sí | Ola 6 completa |
| 8 | 8A, 8B, 8C | Sí | Ola 7 completa |

> **Regla de oro:** `npx tsc --noEmit` después de cada ola. Si falla → no continuar.
> **Checkpoint Vercel:** después de Ola 6 y después de Ola 8.

---

## OLA 6 — Fix base + Cajas + Seed
> Ejecutar 6A + 6B + 6C en PARALELO

---

## Agente 6A — Fix globals.css + next.config imagen externa
**Puede ejecutarse en paralelo con:** 6B, 6C
**Depende de:** nada

### Objetivo
Corregir el font-family del body en globals.css y habilitar imágenes externas de `i.pravatar.cc` en next.config.ts.

### Archivos a modificar
- `src/app/globals.css` — cambiar `--font-geist-sans` por `--font-inter` en el body
- `next.config.ts` — agregar `images.remotePatterns` para `i.pravatar.cc`

### Prompt completo para el agente

```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de cualquier edición.

STACK: Next.js 14.2.18, Tailwind v4 (@theme inline en globals.css), TypeScript strict.

TAREA 1 — Corregir src/app/globals.css:
Leer el archivo actual. En la sección `body {}`, cambiar:
  font-family: var(--font-geist-sans), sans-serif;
por:
  font-family: var(--font-sans), sans-serif;
El token --font-sans ya está mapeado a var(--font-inter) en el bloque @theme inline.
No tocar ninguna otra línea del archivo.

TAREA 2 — Corregir next.config.ts:
Leer el archivo actual. Agregar soporte para imágenes externas de pravatar.cc.
El archivo actualmente tiene solo la config de turbopack.
Agregar la propiedad `images` con remotePatterns:

const nextConfig: NextConfig = {
  turbopack: { ... }, // mantener lo existente
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.pravatar.cc',
      },
    ],
  },
};

CRITERIO DE ÉXITO:
- npx tsc --noEmit → 0 errores
- globals.css tiene font-family: var(--font-sans) en body
- next.config.ts tiene images.remotePatterns con pravatar.cc
```

---

## Agente 6B — Cajas: páginas nuevo + [id] + API apertura/cierre
**Puede ejecutarse en paralelo con:** 6A, 6C
**Depende de:** nada

### Objetivo
Completar el módulo Cajas con página de nueva caja (apertura), detalle de caja `[id]` (con movimientos y cierre), y los endpoints de API.

### Archivos a crear
- `src/app/(dashboard)/cajas/nuevo/page.tsx` — formulario apertura de caja
- `src/app/(dashboard)/cajas/[id]/page.tsx` — detalle caja: movimientos + botón cierre
- `src/app/api/fin/cajas/route.ts` — GET (list) + POST (abrir caja)
- `src/app/api/fin/cajas/[id]/route.ts` — GET (detalle) + PATCH (cerrar caja)

### Archivos a modificar
- `src/app/(dashboard)/cajas/page.tsx` — agregar botón "Abrir caja" que linkea a `/cajas/nuevo`
- `src/firebase/collections.ts` — verificar/agregar `FIN_CAJAS = 'fin_cajas'`

### Prompt completo para el agente

```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de cualquier edición.

STACK: Next.js 14.2.18, TypeScript strict, Firebase Admin SDK (server), Firebase Client SDK (client).
Radix UI components en src/components/ui/ (button, card, input, label, dialog, badge, data-table).
apiFetch en src/lib/apiFetch.ts para llamadas client-side con Bearer token automático.
withAuth en src/lib/api/withAuth.ts para proteger API routes.
Colecciones Firestore en src/firebase/collections.ts (prefijo fin_).

REGLAS DE RENDERIZACIÓN OBLIGATORIAS:
- Páginas con useState/useEffect/onClick → 'use client' al inicio
- API routes → solo firebase-admin, nunca 'use client'
- Formularios → React Hook Form + Zod

MODELO A SEGUIR:
- Leer src/app/(dashboard)/cobros/nuevo/page.tsx como modelo de formulario
- Leer src/app/api/fin/cobros/route.ts como modelo de API route
- Leer src/app/(dashboard)/cobros/page.tsx como modelo de lista con botón

DOMINIO — Una "caja" representa la operación de una sucursal en un día:
- apertura: fecha, sucursal_id, monto_inicial, usuario que abre
- estado: 'abierta' | 'cerrada'
- cierre: monto_final, diferencia (monto_final - monto_inicial - cobros_del_dia), timestamp_cierre
- movimientos: referencia a los cobros registrados durante la apertura

TIPO FinCaja (crear si no existe en src/types/):
{
  id: string
  organizacion_id: string
  sucursal_id: string
  fecha: string           // ISO date YYYY-MM-DD
  estado: 'abierta' | 'cerrada'
  monto_inicial: number
  monto_final?: number
  diferencia?: number
  cobros_del_dia: number  // cantidad de cobros registrados
  monto_cobrado: number   // suma de cobros
  abierta_por: string     // uid
  cerrada_por?: string
  created_at: string
  closed_at?: string
}

CREAR src/app/api/fin/cajas/route.ts:
- GET: listar cajas de la organización, ordenadas por fecha DESC, limit 50
- POST: abrir nueva caja
  body: { sucursal_id: string, monto_inicial: number, fecha: string }
  Validar con Zod. Verificar que no exista una caja ABIERTA para esa sucursal y fecha.
  Si ya existe → 409 Conflict con mensaje "Ya existe una caja abierta para esta sucursal hoy."
  Si no → crear documento en fin_cajas con estado:'abierta', cobros_del_dia:0, monto_cobrado:0
  Devolver { id, caja }
- Ambos con withAuth

CREAR src/app/api/fin/cajas/[id]/route.ts:
- GET: detalle de la caja (incluir lista de cobros asociados buscando en fin_cobros donde caja_id == id)
- PATCH: cerrar caja
  body: { monto_final: number }
  Validar que la caja existe y está en estado 'abierta'
  Calcular diferencia = monto_final - monto_cobrado
  Actualizar estado:'cerrada', monto_final, diferencia, cerrada_por, closed_at
  Si ya está cerrada → 409 "La caja ya fue cerrada."
- Ambos con withAuth

CREAR src/app/(dashboard)/cajas/nuevo/page.tsx — 'use client':
- Formulario con React Hook Form + Zod
- Campos: sucursal_id (select o input), monto_inicial (número), fecha (date, default hoy)
- Al enviar: apiFetch POST /api/fin/cajas
- Si 409: mostrar error "Ya existe una caja abierta para esta sucursal hoy"
- Si OK: router.push('/cajas')
- Usar componentes de src/components/ui/ (Button, Card, Input, Label)

CREAR src/app/(dashboard)/cajas/[id]/page.tsx — 'use client':
- Cargar caja con apiFetch GET /api/fin/cajas/[id]
- Mostrar: fecha, sucursal, estado (Badge verde='abierta' / gris='cerrada'), monto_inicial
- Si estado === 'abierta': mostrar botón "Cerrar caja" que abre un Dialog
  El Dialog tiene un Input para monto_final
  Al confirmar: apiFetch PATCH /api/fin/cajas/[id] con { monto_final }
  Si diferencia > 0: toast "Sobrante: $X" / si < 0: toast "Faltante: $X"
  Recargar la caja después del cierre
- Tabla de cobros del día (si los hay): cliente, monto, método, hora

MODIFICAR src/app/(dashboard)/cajas/page.tsx:
- Agregar botón "Abrir caja" (top right) que linkea a /cajas/nuevo
- Mantener la lista existente

CRITERIO DE ÉXITO:
- npx tsc --noEmit → 0 errores
- No hay imports de 'firebase' (client SDK) en API routes
- No hay imports de 'firebase-admin' en componentes
- Formulario de apertura valida datos y muestra error de caja ya abierta
- Cierre calcula diferencia y muestra sobrante/faltante
```

---

## Agente 6C — Script seed: datos demo en Firestore
**Puede ejecutarse en paralelo con:** 6A, 6B
**Depende de:** nada

### Objetivo
Crear script Node.js que popula Firestore con datos demo realistas: 1 organización, 3 clientes, 2 créditos activos con cuotas, 5 cobros, plan de cuentas base, 1 caja abierta.

### Archivos a crear
- `scripts/seed.ts` — script seed completo
- `scripts/seed.md` — instrucciones de uso (cómo ejecutar)

### Prompt completo para el agente

```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de cualquier edición.

STACK: TypeScript, Firebase Admin SDK.
El proyecto usa firebase-admin 13.5. Las colecciones tienen prefijo fin_.
Leer src/firebase/collections.ts para ver todos los nombres exactos de colecciones.
Leer src/firebase/admin.ts para ver cómo inicializar el Admin SDK.
Leer src/types/fin-cliente.ts, src/types/fin-credito.ts, src/types/fin-cuota.ts
  para ver las estructuras exactas de datos.

CREAR scripts/seed.ts:

El script debe:
1. Inicializar Firebase Admin usando las env vars (FIREBASE_PROJECT_ID, etc.)
2. Usar una organización de prueba: organizacion_id = 'org-demo-prestalo'
3. Limpiar primero los documentos de prueba de esa organización antes de insertar
   (para que sea re-ejecutable sin duplicados)
4. Insertar en este orden:

PLAN DE CUENTAS BASE (colección fin_plan_cuentas):
- 1.1.01 - Caja y Bancos (Activo)
- 1.1.02 - Préstamos por Cobrar (Activo)
- 1.1.03 - Intereses Devengados (Activo)
- 2.1.01 - Préstamos a Pagar (Pasivo)
- 4.1.01 - Ingresos por Intereses (Resultado+)
- 5.1.01 - Gastos Financieros (Resultado-)

CLIENTES (colección fin_clientes):
- Cliente 1: Carlos Mendoza, CUIT 20-28765432-1, Rosario, activo
- Cliente 2: María González, CUIT 27-32145678-5, Rosario, activo
- Cliente 3: Roberto Díaz, CUIT 20-19876543-0, Córdoba, activo

CRÉDITOS (colección fin_creditos):
- Crédito 1: Cliente 1, capital $150000, tasa 3.5% mensual, 12 cuotas, sistema francés,
  fecha_primer_vencimiento = primer día del mes siguiente al día de hoy,
  estado: 'activo'
- Crédito 2: Cliente 2, capital $80000, tasa 2.8% mensual, 6 cuotas, sistema francés,
  fecha_primer_vencimiento = primer día del mes siguiente,
  estado: 'activo'

CUOTAS (colección fin_cuotas) — para cada crédito:
- Generar las cuotas usando el algoritmo de amortización francés:
  cuota_fija = capital * tasa / (1 - (1 + tasa)^-n)
  Para cada cuota: numero, fecha_vencimiento, capital_amortizado, interes, cuota_total,
  estado: primera cuota del primer crédito con estado 'pagada', resto 'pendiente'

COBROS (colección fin_cobros) — 5 cobros:
- Cobro 1: Crédito 1, Cuota 1 (la pagada), método 'efectivo', monto = cuota_total
- Cobros 2-5: fechas pasadas de los últimos 4 días, cliente 1 y 2, montos aleatorios razonables

ASIENTOS (colección fin_asientos) — 2 asientos de otorgamiento:
- Asiento por otorgamiento Crédito 1: Debe 1.1.02 $150000 / Haber 1.1.01 $150000
- Asiento por otorgamiento Crédito 2: Debe 1.1.02 $80000 / Haber 1.1.01 $80000

CAJA (colección fin_cajas):
- 1 caja abierta hoy: sucursal_id='suc-central', monto_inicial=5000,
  cobros_del_dia=1, monto_cobrado=cuota_total_credito_1_cuota_1

5. Al terminar: mostrar resumen de lo insertado:
   "✓ 6 cuentas insertadas"
   "✓ 3 clientes insertados"
   "✓ 2 créditos insertados"
   "✓ 18 cuotas insertadas"
   "✓ 5 cobros insertados"
   "✓ 2 asientos insertados"
   "✓ 1 caja insertada"

CREAR scripts/seed.md con instrucciones:
- Cómo configurar las env vars
- Comando: npx ts-node --project tsconfig.json scripts/seed.ts
- Advertencia: solo para desarrollo/demo, nunca en producción
- Cómo verificar en Firebase Console

IMPORTANTE:
- Usar fecha de hoy para calcular vencimientos (new Date())
- Todos los IDs generados con crypto.randomUUID() o push de Firestore
- El script es idempotente: borrar primero, luego insertar
- TypeScript strict: no usar 'any', usar los tipos de src/types/

CRITERIO DE ÉXITO:
- npx tsc --noEmit scripts/seed.ts (sin errores de tipos)
- Ejecutar el script → Firebase Console muestra los documentos en fin_clientes, fin_creditos, etc.
- El dashboard de la app muestra los KPIs reales (no más "—")
```

---

## OLA 7 — Scoring crediticio + Subledger por cliente
> Ejecutar solo después de que OLA 6 esté completa (tsc 0 errores)
> Ejecutar 7A + 7B en PARALELO

---

## Agente 7A — Scoring crediticio: servicio + API + UI básica
**Puede ejecutarse en paralelo con:** 7B
**Depende de:** Ola 6 completa

### Objetivo
Implementar el motor de scoring crediticio definido en `reports/42_PD-CRE-001_PROCESO_EVALUACION_RIESGO_CREDITO.md`: 14 ítems ponderados, 4 tiers (A/B/C/Reprobado), integración con Nosis.

### Archivos a crear
- `src/types/fin-evaluacion.ts` — tipos de evaluación crediticia
- `src/services/ScoringService.ts` — cálculo de score ponderado + tier
- `src/app/api/fin/clientes/[id]/evaluacion/route.ts` — POST crear evaluación, GET historial
- `src/app/(dashboard)/clientes/[id]/evaluacion/page.tsx` — formulario de evaluación
- `src/app/(dashboard)/clientes/[id]/evaluacion/historial/page.tsx` — historial de evaluaciones

### Prompt completo para el agente

```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de cualquier edición.

STACK: Next.js 14.2.18, TypeScript strict, Firebase Admin SDK (server).
Leer src/types/fin-cliente.ts como modelo de tipos.
Leer src/services/ClienteService.ts como modelo de servicio.
Leer src/app/api/fin/clientes/route.ts como modelo de API route.
Leer src/app/(dashboard)/clientes/[id]/page.tsx como modelo de página detalle.
Leer reports/42_PD-CRE-001_PROCESO_EVALUACION_RIESGO_CREDITO.md para el modelo completo de scoring.

CREAR src/types/fin-evaluacion.ts:

type ScoringItem = {
  id: string
  categoria: 'cualitativo' | 'conflictos' | 'cuantitativo'
  nombre: string
  peso: number        // peso relativo dentro de la categoría
  puntaje: number | null  // 1-10 o null si no evaluado
  nota?: string
}

type EvaluacionTier = 'A' | 'B' | 'C' | 'reprobado'

type FinEvaluacion = {
  id: string
  organizacion_id: string
  cliente_id: string
  fecha: string
  evaluado_por: string  // uid
  items: ScoringItem[]
  score_cualitativo: number    // ponderado, sobre 10
  score_conflictos: number     // ponderado, sobre 10
  score_cuantitativo: number   // ponderado, sobre 10
  score_final: number          // promedio ponderado global
  tier: EvaluacionTier
  limite_credito_sugerido?: number  // calculado según tier
  nosis_consultado: boolean
  nosis_resultado?: Record<string, unknown>
  observaciones?: string
  estado: 'borrador' | 'aprobada' | 'rechazada'
  created_at: string
}

Los 14 ítems son los del PD-CRE-001:
CUALITATIVOS (43% del score total):
  - gestion_empresa (gestión general de la empresa)
  - condiciones_mercado (condiciones del mercado/sector)
  - organizacion_interna (organización interna)
  - situacion_cheques (situación de cheques)
  - terminos_pago (términos de pago con proveedores)
  - crecimiento_ventas (crecimiento de ventas)
  - fidelizacion (historia y fidelización con nosotros)

CONFLICTOS (31% del score total):
  - concursos_quiebras (concursos o quiebras pasadas)
  - situacion_fiscal (situación fiscal/impositiva)
  - cheques_rechazados (cheques rechazados en el sistema)

CUANTITATIVOS (26% del score total):
  - situacion_economica (situación económica general)
  - situacion_financiera (ratios financieros)
  - volumenes_negocio (volúmenes de negocio)
  - situacion_patrimonial (patrimonio neto y garantías)

Fórmula de score final:
  score_final = (promedio_cualitativos * 0.43) + (promedio_conflictos * 0.31) + (promedio_cuantitativos * 0.26)

Tiers:
  A: score_final >= 8.0 → límite = patrimonio_neto * 0.50 (si no se sabe: null)
  B: score_final >= 6.0 → límite = patrimonio_neto * 0.40
  C: score_final >= 4.0 → límite = patrimonio_neto * 0.30
  reprobado: score_final < 4.0 → no otorgar crédito

CREAR src/services/ScoringService.ts:
- calcularScore(items: ScoringItem[]): { score_cualitativo, score_conflictos, score_cuantitativo, score_final, tier }
- crearEvaluacion(orgId, clienteId, data, uid): Promise<string> — guarda en fin_evaluaciones
- getEvaluaciones(orgId, clienteId): Promise<FinEvaluacion[]>
- getUltimaEvaluacion(orgId, clienteId): Promise<FinEvaluacion | null>
- Usar getAdminFirestore() de '@/firebase/admin'

CREAR src/app/api/fin/clientes/[id]/evaluacion/route.ts:
- GET: ScoringService.getEvaluaciones(orgId, params.id) → lista de evaluaciones
- POST: body con los 14 items (puntajes 1-10) + observaciones + nosis_consultado
  Llamar ScoringService.calcularScore → ScoringService.crearEvaluacion
  Devolver { id, evaluacion }
- Wrapped con withAuth

CREAR src/app/(dashboard)/clientes/[id]/evaluacion/page.tsx — 'use client':
- Formulario con los 14 ítems agrupados por categoría (3 secciones)
- Cada ítem: nombre descriptivo + slider o input numérico 1-10
- Mostrar score parcial por categoría en tiempo real (calcular en cliente)
- Mostrar score final estimado + tier estimado mientras completa
- Checkbox "Consulté Nosis"
- Textarea "Observaciones"
- Botón "Guardar evaluación"
- Al guardar: POST /api/fin/clientes/[id]/evaluacion
- Mostrar resultado: Badge verde (A/B) / amarillo (C) / rojo (reprobado) + límite sugerido

CREAR src/app/(dashboard)/clientes/[id]/evaluacion/historial/page.tsx — 'use client':
- Tabla de evaluaciones anteriores: fecha, evaluador, tier (badge color), score final
- Click en fila → ver detalle de la evaluación

MODIFICAR src/app/(dashboard)/clientes/[id]/page.tsx:
- Agregar botón/link "Nueva evaluación crediticia" que navega a /clientes/[id]/evaluacion
- Mostrar badge del último tier si existe (GET /api/fin/clientes/[id]/evaluacion → primera)

CRITERIO DE ÉXITO:
- npx tsc --noEmit → 0 errores
- No hay imports de 'firebase' en servicios o API routes
- El cálculo de score es correcto: 7 cualitativos promediados * 0.43 + 3 conflictos * 0.31 + 4 cuantitativos * 0.26
- Tier se calcula correctamente
- Formulario muestra score en tiempo real
```

---

## Agente 7B — customer_ledger_entries: subledger por cliente
**Puede ejecutarse en paralelo con:** 7A
**Depende de:** Ola 6 completa

### Objetivo
Implementar el subledger por cliente (`fin_ledger_entries`) definido en `reports/16_ESPECIFICACION_CORE_CREDITO_Y_VENTA_FINANCIADA_2026-03-10.md`: registrar un movimiento de ledger por cada cobro, y exponer la cuenta corriente por cliente como API + UI.

### Archivos a crear
- `src/types/fin-ledger.ts` — tipos del ledger
- `src/services/LedgerService.ts` — registrar entrada + obtener saldo + historial
- `src/app/api/fin/clientes/[id]/ledger/route.ts` — GET movimientos + saldo
- `src/app/(dashboard)/clientes/[id]/cuenta-corriente/page.tsx` — extracto del cliente

### Archivos a modificar
- `src/app/api/fin/cobros/route.ts` — al crear cobro, llamar LedgerService.registrarCobro()

### Prompt completo para el agente

```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de cualquier edición.

STACK: Next.js 14.2.18, TypeScript strict, Firebase Admin SDK.
Leer src/services/JournalEntryService.ts como modelo de servicio de registros.
Leer src/types/fin-cobro.ts y src/types/fin-credito.ts para entender el dominio.
Leer reports/16_ESPECIFICACION_CORE_CREDITO_Y_VENTA_FINANCIADA_2026-03-10.md
  sección "customer_ledger_entries" para el modelo completo.

CREAR src/types/fin-ledger.ts:

type LedgerEntryType =
  | 'otorgamiento'      // cuando se otorga un crédito
  | 'cobro_cuota'       // cuando se cobra una cuota
  | 'ajuste_manual'     // ajuste manual
  | 'mora'              // cargo por mora
  | 'refinanciacion'    // refinanciación de deuda

type FinLedgerEntry = {
  id: string
  organizacion_id: string
  cliente_id: string
  fecha: string              // ISO date
  tipo: LedgerEntryType
  descripcion: string        // ej: "Cobro cuota 3/12 - Crédito #C001"
  credito_id?: string
  cobro_id?: string
  cuota_numero?: number
  debe: number               // monto a favor de la financiera (cobros, intereses)
  haber: number              // monto a favor del cliente (otorgamientos)
  saldo_acumulado: number    // saldo running (calculado al insertar)
  created_at: string
}

CREAR src/services/LedgerService.ts:

MÉTODO registrarCobro(orgId, clienteId, cobro: FinCobro, descripcion: string): Promise<string>
  - Obtener el último saldo del cliente (último ledger entry, ordenado por created_at DESC, limit 1)
  - Si no hay entradas previas → saldo_anterior = 0
  - Calcular saldo_acumulado = saldo_anterior + cobro.monto_total
  - Insertar entrada con tipo='cobro_cuota', debe=cobro.monto_total, haber=0

MÉTODO registrarOtorgamiento(orgId, clienteId, creditoId, capital): Promise<string>
  - Similar pero tipo='otorgamiento', haber=capital, debe=0
  - saldo_acumulado = saldo_anterior - capital (el cliente debe más)

MÉTODO getMovimientos(orgId, clienteId, limit=50): Promise<FinLedgerEntry[]>
  - Ordenar por fecha DESC

MÉTODO getSaldo(orgId, clienteId): Promise<number>
  - Obtener último ledger entry → retornar saldo_acumulado
  - Si no hay entries → retornar 0

Usar getAdminFirestore() de '@/firebase/admin'.
Colección: 'fin_ledger_entries'
Agregar al archivo src/firebase/collections.ts: FIN_LEDGER = 'fin_ledger_entries'

CREAR src/app/api/fin/clientes/[id]/ledger/route.ts:
- GET: LedgerService.getMovimientos(orgId, params.id)
  Incluir también el saldo actual: { movimientos, saldo_actual }
- Wrapped con withAuth

CREAR src/app/(dashboard)/clientes/[id]/cuenta-corriente/page.tsx — 'use client':
- Cargar movimientos con apiFetch GET /api/fin/clientes/[id]/ledger
- Header: nombre del cliente + saldo actual (resaltado en badge)
- Tabla de movimientos: fecha, tipo (badge), descripción, debe, haber, saldo acumulado
  - Tipo='cobro_cuota' → badge verde
  - Tipo='otorgamiento' → badge azul
  - Tipo='mora' → badge rojo
- Saldo positivo = cliente tiene saldo a favor / negativo = cliente debe

MODIFICAR src/app/api/fin/cobros/route.ts:
Leer el archivo actual. En el POST (al crear cobro exitosamente):
  Después de guardar el cobro en Firestore, agregar:
  import { LedgerService } from '@/services/LedgerService'
  await LedgerService.registrarCobro(organizationId, cobro.cliente_id, cobro,
    `Cobro cuota ${cobro.numero_cuota} - Crédito ${cobro.credito_id}`)
  Si LedgerService.registrarCobro falla, logear el error pero NO abortar la respuesta
  (el cobro ya fue guardado — el ledger es secundario).

MODIFICAR src/app/(dashboard)/clientes/[id]/page.tsx:
- Agregar link/botón "Ver cuenta corriente" → /clientes/[id]/cuenta-corriente
- Mostrar saldo actual del cliente (GET /api/fin/clientes/[id]/ledger → saldo_actual)

CRITERIO DE ÉXITO:
- npx tsc --noEmit → 0 errores
- Al registrar un cobro → aparece entrada en fin_ledger_entries
- La cuenta corriente muestra movimientos con saldo running correcto
- Saldo = suma de todos los 'debe' - suma de todos los 'haber'
```

---

## OLA 8 — Reporting + Refinanciación + Mejoras UI
> Ejecutar solo después de que OLA 7 esté completa (tsc 0 errores)
> Ejecutar 8A + 8B + 8C en PARALELO

---

## Agente 8A — Dashboard P&L y Aging de cartera
**Puede ejecutarse en paralelo con:** 8B, 8C
**Depende de:** Ola 7 completa

### Objetivo
Agregar al dashboard dos secciones de reporting: Estado de resultados simplificado (P&L) y Aging de cartera (cuotas por estado de mora).

### Archivos a crear
- `src/app/api/fin/dashboard/pnl/route.ts` — P&L del mes actual
- `src/app/api/fin/dashboard/aging/route.ts` — aging de cartera
- `src/app/(dashboard)/reportes/page.tsx` — página de reportes

### Archivos a modificar
- `src/app/(dashboard)/page.tsx` — agregar links a reportes

### Prompt completo para el agente

```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de cualquier edición.

STACK: Next.js 14.2.18, TypeScript strict, Firebase Admin SDK (server).
Recharts 2.13 para gráficos (ya instalado).
Leer src/app/api/fin/dashboard/route.ts como modelo de API.
Leer src/app/(dashboard)/page.tsx como modelo de dashboard.

CREAR src/app/api/fin/dashboard/pnl/route.ts:
- GET: calcula P&L del mes actual (o mes pasado si ?mes=YYYY-MM)
- Leer fin_asientos del mes filtrando por tipo:
  - ingresos_intereses: asientos tipo 'cobro_interes' → suma haber cuenta 4.1.01
  - gastos_financieros: asientos tipo 'gasto' → suma debe cuenta 5.1.01
  - resultado_neto = ingresos - gastos
- Leer fin_cobros del mes: cantidad + monto total
- Devolver: { ingresos_intereses, gastos_financieros, resultado_neto, cobros_cantidad, cobros_monto, mes }
- Wrapped con withAuth

CREAR src/app/api/fin/dashboard/aging/route.ts:
- GET: aging de cartera — cuotas agrupadas por días de mora
  Leer todas las fin_cuotas con estado='pendiente' o 'vencida'
  Para cada cuota calcular días de mora = hoy - fecha_vencimiento (si es pasada)
  Agrupar en buckets:
    al_dia: fecha_vencimiento >= hoy
    mora_1_30: 1 a 30 días
    mora_31_60: 31 a 60 días
    mora_61_90: 61 a 90 días
    mora_90_mas: más de 90 días
  Para cada bucket: cantidad de cuotas + monto total
- Devolver: { al_dia, mora_1_30, mora_31_60, mora_61_90, mora_90_mas, total_cartera }
- Wrapped con withAuth

CREAR src/app/(dashboard)/reportes/page.tsx — 'use client':
- Sección 1 — P&L del mes:
  Selector de mes (default: mes actual)
  3 cards: Ingresos por intereses / Gastos / Resultado neto (verde si positivo, rojo si negativo)

- Sección 2 — Aging de cartera:
  Tabla con los 5 buckets de mora: nombre, cantidad cuotas, monto, % del total
  BarChart de Recharts horizontal mostrando los 5 buckets por monto
  Colores: al_dia=verde, 1-30=amarillo, 31-60=naranja, 61-90=rojo claro, 90+=rojo oscuro

Usar apiFetch para ambas APIs.
Usar Card, Badge de src/components/ui/
Recharts: BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer

MODIFICAR src/app/(dashboard)/page.tsx:
- Agregar sección "Reportes rápidos" al final con 2 cards que linkean a /reportes
- Card 1: "P&L del mes" con BarChart2 icon
- Card 2: "Aging de cartera" con TrendingDown icon

CRITERIO DE ÉXITO:
- npx tsc --noEmit → 0 errores
- P&L muestra ingresos, gastos y resultado del mes
- Aging muestra distribución de mora con gráfico
- No hay imports de 'firebase' (client SDK) en API routes
```

---

## Agente 8B — Refinanciación de deuda: servicio + API + UI
**Puede ejecutarse en paralelo con:** 8A, 8C
**Depende de:** Ola 7 completa

### Objetivo
Implementar la operación de refinanciación: tomar cuotas vencidas de un crédito, consolidarlas en un nuevo plan de pagos, cerrar las cuotas originales y generar asiento contable.

### Archivos a crear
- `src/services/RefinanciacionService.ts` — lógica de refinanciación
- `src/app/api/fin/creditos/[id]/refinanciar/route.ts` — POST refinanciar
- `src/app/(dashboard)/creditos/[id]/refinanciar/page.tsx` — UI de refinanciación

### Prompt completo para el agente

```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de cualquier edición.

STACK: Next.js 14.2.18, TypeScript strict, Firebase Admin SDK.
Leer src/services/CreditoService.ts como modelo de servicio.
Leer src/services/AmortizationService.ts para el cálculo de cuotas.
Leer src/services/JournalEntryService.ts para el modelo de asientos.
Leer src/types/fin-credito.ts, src/types/fin-cuota.ts para los tipos exactos.

DOMINIO — Refinanciación:
Una refinanciación toma las cuotas vencidas (estado='vencida') de un crédito,
consolida el capital pendiente + intereses en un nuevo plan de pagos.
Las cuotas originales vencidas pasan a estado='refinanciada'.
Se genera un nuevo crédito "hijo" con el capital refinanciado.

CREAR src/services/RefinanciacionService.ts:

MÉTODO refinanciar(orgId, creditoId, params, uid):
  params: {
    nueva_tasa_mensual: number
    nueva_cantidad_cuotas: number
    nueva_fecha_primer_vencimiento: string
    observaciones?: string
  }

  1. Cargar el crédito original — verificar que existe y está 'activo'
  2. Cargar cuotas vencidas del crédito (estado='vencida')
  3. Si no hay cuotas vencidas → throw Error('No hay cuotas vencidas para refinanciar')
  4. Calcular capital_refinanciado = suma de (capital_amortizado + interes) de cuotas vencidas
  5. Generar nuevo plan con AmortizationService.calcular({
       capital: capital_refinanciado,
       tasa_mensual: params.nueva_tasa_mensual,
       cantidad_cuotas: params.nueva_cantidad_cuotas,
       fecha_primer_vencimiento: params.nueva_fecha_primer_vencimiento,
       sistema: 'frances'
     })
  6. En una batch write de Firestore:
     a. Crear nuevo crédito (mismo cliente, mismo org) con estado='activo', tipo='refinanciacion'
        campo refinanciacion_de = creditoId
     b. Insertar las nuevas cuotas del nuevo crédito
     c. Actualizar cuotas vencidas del crédito original → estado='refinanciada'
     d. Crear asiento contable: tipo='refinanciacion',
        descripcion=`Refinanciación crédito ${creditoId}`,
        partidas: Debe 1.1.02 capital_refinanciado / Haber 1.1.02 capital_refinanciado
        (cancelación y reconstitución de la deuda)
  7. Retornar { nuevo_credito_id, cuotas_refinanciadas: N, nuevo_capital: X }

CREAR src/app/api/fin/creditos/[id]/refinanciar/route.ts:
- POST: body { nueva_tasa_mensual, nueva_cantidad_cuotas, nueva_fecha_primer_vencimiento, observaciones }
- Validar con Zod
- RefinanciacionService.refinanciar(orgId, params.id, body, user.uid)
- Devolver resultado
- Wrapped con withAuth

CREAR src/app/(dashboard)/creditos/[id]/refinanciar/page.tsx — 'use client':
- Cargar crédito actual con apiFetch GET /api/fin/creditos/[id]
- Mostrar resumen: cuotas vencidas (cantidad + monto total)
- Formulario: nueva_tasa_mensual, nueva_cantidad_cuotas, nueva_fecha_primer_vencimiento
- Preview: calcular en cliente con AmortizationService (si está disponible) o mostrar solo inputs
  Mostrar cuota estimada = capital_vencido * tasa / (1 - (1+tasa)^-n)
- Botón "Refinanciar" con Dialog de confirmación: "Esta acción es irreversible..."
- Al confirmar: POST /api/fin/creditos/[id]/refinanciar
- Si OK: toast + router.push('/creditos/[nuevo_credito_id]')

MODIFICAR src/app/(dashboard)/creditos/[id]/page.tsx:
- Si hay cuotas vencidas: mostrar botón/alerta "Este crédito tiene X cuotas vencidas — Refinanciar"
  Link a /creditos/[id]/refinanciar

CRITERIO DE ÉXITO:
- npx tsc --noEmit → 0 errores
- La refinanciación crea el nuevo crédito con cuotas correctas
- Las cuotas originales quedan en estado='refinanciada'
- El asiento contable se genera correctamente
- Batch write atómica (o error completo — no mitad)
```

---

## Agente 8C — Mejoras UI: navbar activo + breadcrumbs + empty states
**Puede ejecutarse en paralelo con:** 8A, 8B
**Depende de:** Ola 7 completa

### Objetivo
Mejorar la UX general: item activo en el Sidebar, breadcrumbs en páginas de detalle, y empty states con llamadas a acción en listas vacías.

### Archivos a modificar
- `src/components/layout/Sidebar.tsx` — marcar item activo con `usePathname`
- `src/components/layout/Topbar.tsx` — agregar breadcrumb dinámico
- `src/app/(dashboard)/clientes/page.tsx` — empty state
- `src/app/(dashboard)/creditos/page.tsx` — empty state
- `src/app/(dashboard)/cobros/page.tsx` — empty state

### Prompt completo para el agente

```
DIRECTORIO DE TRABAJO: c:\Users\Usuario\Documents\Proyectos\ISO -conjunto\prestaloapp
Verificar con `pwd` antes de cualquier edición.

STACK: Next.js 14.2.18, TypeScript strict, Tailwind v4.
Leer src/components/layout/Sidebar.tsx y src/components/layout/Topbar.tsx primero.
Todos los archivos de layout deben tener 'use client' (ya deberían tenerlo).
Usar usePathname de 'next/navigation' para detectar ruta activa.

MODIFICAR src/components/layout/Sidebar.tsx:
- Agregar 'use client' si no lo tiene
- Usar usePathname() para detectar la ruta actual
- Para cada ítem del nav: si pathname.startsWith(item.href) → aplicar clase activa
  Clase activa: bg-white/15 text-white font-medium (o similar al design system actual)
  Clase inactiva: text-white/70 hover:bg-white/10
- NO cambiar la estructura del menú ni los ítems existentes

MODIFICAR src/components/layout/Topbar.tsx:
- Agregar 'use client' si no lo tiene
- Usar usePathname() para construir breadcrumb
- Mapeo de rutas a nombres legibles:
  /clientes → "Clientes"
  /clientes/nuevo → "Clientes → Nuevo cliente"
  /clientes/[id] → "Clientes → Detalle"
  /creditos → "Créditos"
  /creditos/nuevo → "Créditos → Nuevo crédito"
  /cobros → "Cobros"
  /cajas → "Cajas"
  /asientos → "Contabilidad"
  /plan-cuentas → "Plan de cuentas"
  /reportes → "Reportes"
- Mostrar breadcrumb en el topbar (texto simple, no links)
- NO cambiar el resto del topbar (logout button, etc.)

MODIFICAR src/app/(dashboard)/clientes/page.tsx:
- Si la lista de clientes está vacía (array.length === 0):
  Mostrar empty state centrado:
    Ícono Users (lucide, grande, color muted)
    Título: "No hay clientes todavía"
    Subtítulo: "Empezá cargando tu primer cliente."
    Botón: "Agregar cliente" → /clientes/nuevo

MODIFICAR src/app/(dashboard)/creditos/page.tsx y cobros/page.tsx:
- Mismo patrón de empty state con ícono, título, subtítulo y botón correspondiente
  Créditos: ícono BriefcaseBusiness, "No hay créditos activos", botón "Nuevo crédito"
  Cobros: ícono ReceiptText, "No hay cobros registrados", botón "Registrar cobro"

REGLAS:
- Todos los archivos de páginas modificados deben tener 'use client'
- Los íconos vienen de 'lucide-react' (ya instalado)
- Los empty states reemplazan la tabla cuando no hay datos, no la ocultan

CRITERIO DE ÉXITO:
- npx tsc --noEmit → 0 errores
- El ítem activo en el sidebar tiene estilos distintos al resto
- El topbar muestra el nombre correcto de la sección actual
- Las páginas vacías muestran un empty state con CTA
```

---

## Verificación final (después de Ola 8)

```bash
# Check de TypeScript
npx tsc --noEmit

# Check de imports (Client SDK en server = ERROR)
bash scripts/audit-imports.sh

# Build local
npm run build

# Si todo pasa → commit y push para Checkpoint Vercel
git add -A
git commit -m "feat(olas6-7-8): cajas, seed, scoring, ledger, reporting, refinanciación"
git push origin main
```

### Checklist manual

- [ ] Landing page `/` renderiza con colores brand (verde + amber)
- [ ] Login `/login` funciona y redirige a `/clientes`
- [ ] Dashboard muestra KPIs reales (con datos del seed)
- [ ] Cajas: se puede abrir y cerrar una caja
- [ ] Scoring: se puede evaluar un cliente con los 14 ítems
- [ ] Cuenta corriente: muestra movimientos del cliente
- [ ] Reportes: muestra P&L del mes y aging de cartera
- [ ] Refinanciación: muestra botón en créditos con cuotas vencidas
- [ ] Sidebar activo: el ítem de la ruta actual está destacado
- [ ] Empty states: listas vacías muestran CTA

---

## Orden de ejecución recomendado

```
OLA 6 (paralelo): 6A + 6B + 6C → tsc --noEmit → push → CP Vercel
OLA 7 (paralelo): 7A + 7B → tsc --noEmit
OLA 8 (paralelo): 8A + 8B + 8C → tsc --noEmit → npm run build → push → CP Vercel final
```
